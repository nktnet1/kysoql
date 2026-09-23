import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJson, requireCommand, run } from "./lib/command.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const salesforceDir = path.join(repoRoot, "test", "salesforce");

interface QueryResponse {
  readonly status: number;
  readonly result?: {
    readonly records?: ReadonlyArray<{
      readonly Category__c?: string;
      readonly recordCount?: number;
    }>;
  };
}

function usage(): void {
  console.log(`Usage: pnpm salesforce:aggregate-offset [options]\n\nRun the grouped aggregate OFFSET smoke query against an authenticated org.\n\nOptions:\n  --target-org <alias>  Salesforce org alias (default: kysoql-test)\n  -h, --help            Show this help\n\nEnvironment equivalent:\n  KYSOQL_TARGET_ORG`);
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
  const query =
    "SELECT Category__c, COUNT(Id) recordCount FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' GROUP BY Category__c ORDER BY Category__c LIMIT 2 OFFSET 1";
  const output = run(
    "pnpm",
    ["sf", "data", "query", "--target-org", targetOrg, "--query", query, "--json"],
    { cwd: salesforceDir, capture: true },
  );
  const response = parseJson<QueryResponse>(output, "Salesforce CLI");
  if (response.status !== 0) {
    throw new Error("Salesforce grouped aggregate OFFSET query failed.");
  }

  const actual = (response.result?.records ?? []).map((record) => ({
    category: record.Category__c,
    count: record.recordCount,
  }));
  const expected = [
    { category: "Beta", count: 1 },
    { category: "Gamma", count: 1 },
  ];

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Unexpected grouped aggregate OFFSET result: ${JSON.stringify(actual)}`,
    );
  }
  console.log(`Grouped aggregate OFFSET smoke test passed for ${targetOrg}.`);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
