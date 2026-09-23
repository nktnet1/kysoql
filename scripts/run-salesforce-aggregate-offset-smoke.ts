import path from "node:path";

import { Command, Flags } from "@oclif/core";

import { parseJson, requireCommand, run } from "./lib/command.ts";
import { readSalesforceTargetEnvironment } from "./lib/environment.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "./lib/oclif.ts";

const salesforceDir = path.join(repositoryRoot, "test", "salesforce");

interface QueryResponse {
  readonly status: number;
  readonly result?: {
    readonly records?: ReadonlyArray<{
      readonly Category__c?: string;
      readonly recordCount?: number;
    }>;
  };
}

class SalesforceAggregateOffsetSmoke extends Command {
  static description =
    "Run the grouped aggregate OFFSET smoke query against an authenticated Salesforce org.";

  static flags = {
    help: Flags.help({ char: "h" }),
    "target-org": Flags.string({
      description: "Salesforce org alias (default: KYSOQL_TARGET_ORG or kysoql-test).",
      helpValue: "<alias>",
    }),
  };

  static summary = "Run the Salesforce aggregate OFFSET smoke query.";

  async run(): Promise<void> {
    const { flags } = await this.parse(SalesforceAggregateOffsetSmoke);
    const environment = readSalesforceTargetEnvironment();
    const targetOrg = flags["target-org"] ?? environment.KYSOQL_TARGET_ORG;

    requireCommand("pnpm");
    const query =
      "SELECT Category__c, COUNT(Id) recordCount FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' GROUP BY Category__c ORDER BY Category__c LIMIT 2 OFFSET 1";
    const output = run(
      "pnpm",
      [
        "sf",
        "data",
        "query",
        "--target-org",
        targetOrg,
        "--query",
        query,
        "--json",
      ],
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
    this.log(`Grouped aggregate OFFSET smoke test passed for ${targetOrg}.`);
  }
}

try {
  await SalesforceAggregateOffsetSmoke.run(
    process.argv.slice(2),
    repositoryCommandLoadOptions,
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
