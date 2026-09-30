import path from "node:path";

import { Command, Flags } from "@oclif/core";

import {
  parseJson,
  requireCommand,
  requireSupportedNode,
  run,
  succeeds,
} from "./lib/command.ts";
import {
  parseScratchDurationDays,
  readSalesforceSetupEnvironment,
} from "./lib/environment.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "./lib/oclif.ts";

const salesforceDir = path.join(repositoryRoot, "test", "salesforce");

interface QueryResponse {
  readonly status: number;
  readonly result?: {
    readonly totalSize?: number;
  };
}

interface SetupOptions {
  readonly devHubAlias: string;
  readonly scratchAlias: string;
  readonly durationDays: number;
  readonly recreate: boolean;
  readonly skipInstall: boolean;
  readonly noLogin: boolean;
}

class SetupSalesforceTestOrg extends Command {
  static description =
    "Create, deploy, seed, and smoke-test the Kysoql Salesforce scratch org.";

  static flags = {
    help: Flags.help({ char: "h" }),
    alias: Flags.string({
      description:
        "Scratch org alias (default: KYSOQL_SCRATCH_ALIAS or kysoql-test).",
      helpValue: "<alias>",
    }),
    "dev-hub": Flags.string({
      description:
        "Dev Hub alias (default: KYSOQL_DEV_HUB_ALIAS or kysoql-dev-hub).",
      helpValue: "<alias>",
    }),
    "duration-days": Flags.integer({
      description:
        "Scratch org lifetime in days (default: KYSOQL_SCRATCH_DURATION_DAYS or 30).",
      helpValue: "<days>",
    }),
    recreate: Flags.boolean({
      description: "Delete an existing scratch org with the target alias first.",
    }),
    "skip-install": Flags.boolean({
      description: "Skip pnpm install --frozen-lockfile.",
    }),
    "no-login": Flags.boolean({
      description:
        "Fail instead of opening a browser when Dev Hub auth is missing.",
    }),
  };

  static summary = "Prepare the Salesforce scratch org used by Kysoql tests.";

  async run(): Promise<void> {
    const { flags } = await this.parse(SetupSalesforceTestOrg);
    const environment = readSalesforceSetupEnvironment();
    const options: SetupOptions = {
      devHubAlias: flags["dev-hub"] ?? environment.KYSOQL_DEV_HUB_ALIAS,
      scratchAlias: flags.alias ?? environment.KYSOQL_SCRATCH_ALIAS,
      durationDays: parseScratchDurationDays(
        flags["duration-days"] ?? environment.KYSOQL_SCRATCH_DURATION_DAYS,
      ),
      recreate: flags.recreate === true,
      skipInstall: flags["skip-install"] === true,
      noLogin: flags["no-login"] === true,
    };

    if (options.devHubAlias === options.scratchAlias) {
      throw new Error("Dev Hub and scratch org aliases must be different.");
    }

    let createdScratch = false;
    const cleanupHint = (): void => {
      if (!createdScratch) {
        return;
      }
      console.error(
        "\nThe scratch org was created but setup did not complete. It was not deleted automatically.",
      );
      console.error(
        `Inspect it with: pnpm sf org open --target-org ${JSON.stringify(options.scratchAlias)}`,
      );
      console.error(
        `Delete it with:  pnpm sf org delete scratch --target-org ${JSON.stringify(options.scratchAlias)} --no-prompt`,
      );
    };

    const sf = (args: readonly string[], capture = false): string =>
      run("pnpm", ["sf", ...args], {
        cwd: salesforceDir,
        ...(capture ? { capture: true } : {}),
      });

    const orgExists = (alias: string): boolean =>
      succeeds(
        "pnpm",
        ["sf", "org", "display", "--target-org", alias, "--json"],
        { cwd: salesforceDir },
      );

    try {
      requireSupportedNode();
      requireCommand("pnpm");

      if (!options.skipInstall) {
        this.log("Installing workspace dependencies from the lockfile...");
        run("pnpm", ["install", "--frozen-lockfile"], { cwd: repositoryRoot });
      }

      sf(["--version"]);

      if (!orgExists(options.devHubAlias)) {
        if (options.noLogin || !process.stdin.isTTY) {
          throw new Error(
            `Dev Hub '${options.devHubAlias}' is not authenticated. Run: pnpm sf org login web --alias '${options.devHubAlias}'`,
          );
        }
        this.log(
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
        this.log(
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

      this.log(
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

      this.log("Deploying fixture metadata...");
      sf([
        "project",
        "deploy",
        "start",
        "--target-org",
        options.scratchAlias,
        "--source-dir",
        "force-app",
      ]);

      this.log("Deploying custom Big Object fixture metadata...");
      sf([
        "project",
        "deploy",
        "start",
        "--target-org",
        options.scratchAlias,
        "--metadata-dir",
        "big-object-metadata",
      ]);

      this.log("Assigning Kysoql_Test permission set...");
      sf([
        "org",
        "assign",
        "permset",
        "--target-org",
        options.scratchAlias,
        "--name",
        "Kysoql_Test",
      ]);

      this.log("Seeding deterministic fixture data...");
      sf([
        "apex",
        "run",
        "--target-org",
        options.scratchAlias,
        "--file",
        "scripts/apex/seed.apex",
      ]);

      this.log("Running static Apex bind smoke test...");
      sf([
        "apex",
        "run",
        "--target-org",
        options.scratchAlias,
        "--file",
        "scripts/apex/static-bind-smoke.apex",
      ]);

      const targetEnv = {
        ...process.env,
        KYSOQL_TARGET_ORG: options.scratchAlias,
      };
      this.log("Running grouped aggregate OFFSET smoke test...");
      run(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(
            import.meta.dirname,
            "run-salesforce-aggregate-offset-smoke.ts",
          ),
        ],
        { cwd: repositoryRoot, env: targetEnv },
      );

      this.log("Running custom Big Object codegen smoke test...");
      run(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(import.meta.dirname, "run-salesforce-big-object-smoke.ts"),
        ],
        { cwd: repositoryRoot, env: targetEnv },
      );

      this.log("Running generated-query Salesforce E2E suite...");
      run(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(import.meta.dirname, "run-salesforce-generated-e2e.ts"),
        ],
        { cwd: repositoryRoot, env: targetEnv },
      );

      this.log("Running fixture smoke test...");
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
      const smoke = parseJson<QueryResponse>(
        smokeOutput,
        "Salesforce smoke query",
      );
      const smokeCount = smoke.status === 0 ? smoke.result?.totalSize : undefined;
      if (smokeCount !== 3) {
        throw new Error(
          `expected 3 seeded Kysoql_Record__c rows; found ${String(smokeCount ?? -1)}`,
        );
      }

      createdScratch = false;
      this.log(
        `\nSalesforce test org is ready.\n\n  Dev Hub:     ${options.devHubAlias}\n  Scratch org: ${options.scratchAlias}\n  Seed rows:   ${smokeCount}\n\nUseful commands:\n  pnpm sf org open --target-org ${options.scratchAlias}\n  pnpm sf data query --target-org ${options.scratchAlias} --query "SELECT Id, Name, External_Id__c FROM Kysoql_Record__c ORDER BY External_Id__c"\n  pnpm sf org delete scratch --target-org ${options.scratchAlias} --no-prompt`,
      );
    } catch (error) {
      cleanupHint();
      throw error;
    }
  }
}

try {
  await SetupSalesforceTestOrg.run(
    process.argv.slice(2),
    repositoryCommandLoadOptions,
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
