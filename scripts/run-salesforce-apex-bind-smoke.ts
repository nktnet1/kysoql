import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireCommand, run } from "./lib/command.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const salesforceDir = path.join(repoRoot, "test", "salesforce");

function usage(): void {
  console.log(`Usage: pnpm salesforce:apex-binds [options]\n\nRun the static-Apex bind-expression smoke fixture against an authenticated org.\n\nOptions:\n  --target-org <alias>  Salesforce org alias (default: kysoql-test)\n  -h, --help            Show this help\n\nEnvironment equivalent:\n  KYSOQL_TARGET_ORG`);
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
  requireCommand("pnpm");
  const targetOrg = parseArgs(process.argv.slice(2));
  run(
    "pnpm",
    [
      "sf",
      "apex",
      "run",
      "--target-org",
      targetOrg,
      "--file",
      "scripts/apex/static-bind-smoke.apex",
    ],
    { cwd: salesforceDir },
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
