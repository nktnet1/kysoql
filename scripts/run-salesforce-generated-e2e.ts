import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireCommand, requireNode26, run } from "./lib/command.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function usage(): void {
  console.log(`Usage: pnpm salesforce:e2e [options]\n\nRun kysoql-generated SOQL against an authenticated Salesforce org with Vitest.\n\nOptions:\n  --target-org <alias>  Salesforce org alias (default: kysoql-test)\n  -h, --help            Show this help\n\nEnvironment equivalent:\n  KYSOQL_TARGET_ORG`);
}

function parseArgs(args: readonly string[]): string {
  let targetOrg = process.env.KYSOQL_TARGET_ORG ?? "kysoql-test";
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--target-org") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--target-org requires a value");
      }
      targetOrg = value;
      index++;
    } else if (argument === "-h" || argument === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }
  return targetOrg;
}

try {
  requireNode26();
  requireCommand("pnpm");
  const targetOrg = parseArgs(process.argv.slice(2));
  run("pnpm", ["--filter", "@kysoql/core", "build"], { cwd: repoRoot });
  run(
    "pnpm",
    ["exec", "vitest", "run", "--config", "vitest.salesforce.config.ts"],
    {
      cwd: repoRoot,
      env: { ...process.env, KYSOQL_TARGET_ORG: targetOrg },
    },
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
