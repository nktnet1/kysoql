import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Command, Flags } from "@oclif/core";

import {
  requireCommand,
  requireSupportedNode,
  run,
  succeeds,
} from "../lib/command.ts";
import { readSalesforceTargetEnvironment } from "../lib/environment.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "../lib/oclif.ts";

class SalesforceBigObjectSmoke extends Command {
  static description =
    "Generate a schema for the scratch-org custom Big Object and verify Tooling metadata output.";

  static flags = {
    help: Flags.help({ char: "h" }),
    "target-org": Flags.string({
      description:
        "Salesforce org alias (default: KYSOQL_TARGET_ORG or kysoql-test).",
      helpValue: "<alias>",
    }),
  };

  static summary = "Smoke-test custom Big Object code generation.";

  async run(): Promise<void> {
    const { flags } = await this.parse(SalesforceBigObjectSmoke);
    const environment = readSalesforceTargetEnvironment();
    const targetOrg = flags["target-org"] ?? environment.KYSOQL_TARGET_ORG;

    requireSupportedNode();
    requireCommand("pnpm");
    if (
      !succeeds(
        "pnpm",
        ["sf", "org", "display", "--target-org", targetOrg, "--json"],
        { cwd: repositoryRoot },
      )
    ) {
      throw new Error(
        `Salesforce org '${targetOrg}' is not authenticated or is unavailable. ` +
          "Run pnpm salesforce:setup first, or pass --target-org for a prepared test org.",
      );
    }

    const directory = await mkdtemp(
      path.join(tmpdir(), "kysoql-big-object-smoke-"),
    );
    const output = path.join(directory, "salesforce.generated.ts");
    try {
      run(
        process.execPath,
        [
          "--experimental-strip-types",
          path.join(import.meta.dirname, "generate-salesforce-schema.ts"),
          "--no-config",
          "--object",
          "Kysoql_Event__b",
          "--output",
          output,
        ],
        {
          cwd: repositoryRoot,
          env: { ...process.env, KYSOQL_TARGET_ORG: targetOrg },
        },
      );

      const source = await readFile(output, "utf8");
      for (const expected of [
        'readonly "Kysoql_Event__b"',
        'readonly "Tenant__c"',
        'readonly "OccurredAt__c"',
        'readonly "Payload__c"',
        '"Kysoql_Event__b": ["Tenant__c", "OccurredAt__c"]',
      ]) {
        if (!source.includes(expected)) {
          throw new Error(
            `generated Big Object schema is missing expected output: ${expected}`,
          );
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }

    this.log(`Custom Big Object codegen passed for '${targetOrg}'.`);
  }
}

try {
  await SalesforceBigObjectSmoke.run(
    process.argv.slice(2),
    repositoryCommandLoadOptions,
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
