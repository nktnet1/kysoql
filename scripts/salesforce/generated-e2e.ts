import { Command, Flags } from "@oclif/core";

import {
  requireCommand,
  requireSupportedNode,
  run,
  succeeds,
} from "../lib/command.ts";
import { readSalesforceTargetEnvironment } from "../lib/environment.ts";
import { errorLine } from "../lib/output.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "../lib/oclif.ts";

class SalesforceGeneratedE2E extends Command {
  static description =
    "Run kysoql-generated SOQL against an authenticated Salesforce org with Vitest.";

  static flags = {
    help: Flags.help({ char: "h" }),
    "target-org": Flags.string({
      description: "Salesforce org alias (default: KYSOQL_TARGET_ORG or kysoql-test).",
      helpValue: "<alias>",
    }),
  };

  static summary = "Run the generated-query Salesforce E2E suite.";

  async run(): Promise<void> {
    const { flags } = await this.parse(SalesforceGeneratedE2E);
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
          "Run pnpm salesforce:setup first, or pass --target-org for an already prepared test org.",
      );
    }
    run("pnpm", ["--filter", "@kysoql/core", "build"], {
      cwd: repositoryRoot,
    });
    run(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.salesforce.config.ts"],
      {
        cwd: repositoryRoot,
        env: { ...process.env, KYSOQL_TARGET_ORG: targetOrg },
      },
    );
  }
}

try {
  await SalesforceGeneratedE2E.run(
    process.argv.slice(2),
    repositoryCommandLoadOptions,
  );
} catch (error) {
  console.error(
    errorLine(error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
}
