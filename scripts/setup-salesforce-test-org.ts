import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseJson,
  requireCommand,
  requireNode26,
  run,
  succeeds,
} from "./lib/command.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const salesforceDir = path.join(repoRoot, "test", "salesforce");

interface Options {
  devHubAlias: string;
  scratchAlias: string;
  durationDays: number;
  recreate: boolean;
  skipInstall: boolean;
  noLogin: boolean;
}

interface QueryResponse {
  readonly status: number;
  readonly result?: {
    readonly totalSize?: number;
  };
}

let createdScratch = false;
let scratchAliasForCleanup = process.env.KYSOQL_SCRATCH_ALIAS ?? "kysoql-test";

function usage(): void {
  console.log(`Usage: pnpm salesforce:setup [options]\n\nCreate, deploy, seed, and smoke-test the kysoql Salesforce scratch org.\n\nOptions:\n  --dev-hub <alias>       Dev Hub alias (default: kysoql-dev-hub)\n  --alias <alias>         Scratch org alias (default: kysoql-test)\n  --duration-days <days>  Scratch org lifetime (default: 30)\n  --recreate              Delete an existing scratch org with the target alias first\n  --skip-install          Skip \`pnpm install --frozen-lockfile\`\n  --no-login              Fail instead of opening a browser when Dev Hub auth is missing\n  -h, --help              Show this help\n\nEnvironment equivalents:\n  KYSOQL_DEV_HUB_ALIAS\n  KYSOQL_SCRATCH_ALIAS\n  KYSOQL_SCRATCH_DURATION_DAYS`);
}

function cleanupHint(): void {
  if (!createdScratch) {
    return;
  }
  console.error(
    "\nThe scratch org was created but setup did not complete. It was not deleted automatically.",
  );
  console.error(
    `Inspect it with: pnpm sf org open --target-org ${JSON.stringify(scratchAliasForCleanup)}`,
  );
  console.error(
    `Delete it with:  pnpm sf org delete scratch --target-org ${JSON.stringify(scratchAliasForCleanup)} --no-prompt`,
  );
}

function parseOptions(args: readonly string[]): Options {
  const durationDefault = process.env.KYSOQL_SCRATCH_DURATION_DAYS ?? "30";
  let options: Options = {
    devHubAlias: process.env.KYSOQL_DEV_HUB_ALIAS ?? "kysoql-dev-hub",
    scratchAlias: process.env.KYSOQL_SCRATCH_ALIAS ?? "kysoql-test",
    durationDays: Number.parseInt(durationDefault, 10),
    recreate: false,
    skipInstall: false,
    noLogin: false,
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--dev-hub") {
      if (!value) throw new Error("--dev-hub requires a value");
      options = { ...options, devHubAlias: value };
      index++;
    } else if (argument === "--alias") {
      if (!value) throw new Error("--alias requires a value");
      options = { ...options, scratchAlias: value };
      index++;
    } else if (argument === "--duration-days") {
      if (!value || !/^\d+$/.test(value)) {
        throw new Error("--duration-days must be an integer");
      }
      options = { ...options, durationDays: Number.parseInt(value, 10) };
      index++;
    } else if (argument === "--recreate") {
      options = { ...options, recreate: true };
    } else if (argument === "--skip-install") {
      options = { ...options, skipInstall: true };
    } else if (argument === "--no-login") {
      options = { ...options, noLogin: true };
    } else if (argument === "-h" || argument === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }

  if (!Number.isInteger(options.durationDays)) {
    throw new Error("--duration-days must be an integer");
  }
  if (options.durationDays < 1 || options.durationDays > 30) {
    throw new Error("--duration-days must be between 1 and 30");
  }
  if (options.devHubAlias === options.scratchAlias) {
    throw new Error("Dev Hub and scratch org aliases must be different");
  }
  return options;
}

function sf(args: readonly string[], capture = false): string {
  return run("pnpm", ["sf", ...args], {
    cwd: salesforceDir,
    ...(capture ? { capture: true } : {}),
  });
}

function orgExists(alias: string): boolean {
  return succeeds(
    "pnpm",
    ["sf", "org", "display", "--target-org", alias, "--json"],
    { cwd: salesforceDir },
  );
}

try {
  const options = parseOptions(process.argv.slice(2));
  scratchAliasForCleanup = options.scratchAlias;
  requireNode26();
  requireCommand("pnpm");

  if (!options.skipInstall) {
    console.log("Installing workspace dependencies from the lockfile...");
    run("pnpm", ["install", "--frozen-lockfile"], { cwd: repoRoot });
  }

  sf(["--version"]);

  if (!orgExists(options.devHubAlias)) {
    if (options.noLogin || !process.stdin.isTTY) {
      throw new Error(
        `Dev Hub '${options.devHubAlias}' is not authenticated. Run: pnpm sf org login web --alias '${options.devHubAlias}'`,
      );
    }
    console.log(
      `Dev Hub '${options.devHubAlias}' is not authenticated; opening Salesforce web login...`,
    );
    sf(["org", "login", "web", "--alias", options.devHubAlias]);
  }

  if (orgExists(options.scratchAlias)) {
    if (!options.recreate) {
      throw new Error(
        `org alias '${options.scratchAlias}' already exists; choose another --alias or pass --recreate`,
      );
    }
    console.log(
      `Deleting existing scratch org '${options.scratchAlias}' because --recreate was requested...`,
    );
    sf([
      "org",
      "delete",
      "scratch",
      "--target-org",
      options.scratchAlias,
      "--no-prompt",
    ]);
  }

  console.log(
    `Creating scratch org '${options.scratchAlias}' from Dev Hub '${options.devHubAlias}'...`,
  );
  sf([
    "org",
    "create",
    "scratch",
    "--definition-file",
    "config/project-scratch-def.json",
    "--alias",
    options.scratchAlias,
    "--target-dev-hub",
    options.devHubAlias,
    "--duration-days",
    String(options.durationDays),
  ]);
  createdScratch = true;

  console.log("Deploying fixture metadata...");
  sf([
    "project",
    "deploy",
    "start",
    "--target-org",
    options.scratchAlias,
    "--source-dir",
    "force-app",
  ]);

  console.log("Assigning Kysoql_Test permission set...");
  sf([
    "org",
    "assign",
    "permset",
    "--target-org",
    options.scratchAlias,
    "--name",
    "Kysoql_Test",
  ]);

  console.log("Seeding deterministic fixture data...");
  sf([
    "apex",
    "run",
    "--target-org",
    options.scratchAlias,
    "--file",
    "scripts/apex/seed.apex",
  ]);

  console.log("Running static Apex bind smoke test...");
  sf([
    "apex",
    "run",
    "--target-org",
    options.scratchAlias,
    "--file",
    "scripts/apex/static-bind-smoke.apex",
  ]);

  const targetEnv = { ...process.env, KYSOQL_TARGET_ORG: options.scratchAlias };
  console.log("Running grouped aggregate OFFSET smoke test...");
  run(process.execPath, [path.join(scriptDir, "run-salesforce-aggregate-offset-smoke.ts")], {
    cwd: repoRoot,
    env: targetEnv,
  });

  console.log("Running generated-query Salesforce E2E suite...");
  run(process.execPath, [path.join(scriptDir, "run-salesforce-generated-e2e.ts")], {
    cwd: repoRoot,
    env: targetEnv,
  });

  console.log("Running fixture smoke test...");
  const smokeOutput = sf(
    [
      "data",
      "query",
      "--target-org",
      options.scratchAlias,
      "--query",
      "SELECT Id, External_Id__c, Account__r.Name FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' ORDER BY External_Id__c",
      "--json",
    ],
    true,
  );
  const smoke = parseJson<QueryResponse>(smokeOutput, "Salesforce smoke query");
  const smokeCount = smoke.status === 0 ? smoke.result?.totalSize : undefined;
  if (smokeCount !== 3) {
    throw new Error(
      `expected 3 seeded Kysoql_Record__c rows; found ${String(smokeCount ?? -1)}`,
    );
  }

  createdScratch = false;
  console.log(`\nSalesforce test org is ready.\n\n  Dev Hub:     ${options.devHubAlias}\n  Scratch org: ${options.scratchAlias}\n  Seed rows:   ${smokeCount}\n\nUseful commands:\n  pnpm sf org open --target-org ${options.scratchAlias}\n  pnpm sf data query --target-org ${options.scratchAlias} --query "SELECT Id, Name, External_Id__c FROM Kysoql_Record__c ORDER BY External_Id__c"\n  pnpm sf org delete scratch --target-org ${options.scratchAlias} --no-prompt`);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  cleanupHint();
  process.exitCode = 1;
}
