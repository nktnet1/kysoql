import path from "node:path";

import { Command, Flags } from "@oclif/core";

import { requireCommand, run } from "../lib/command.ts";
import { readSalesforceTargetEnvironment } from "../lib/environment.ts";
import { errorLine } from "../lib/output.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "../lib/oclif.ts";

const salesforceDir = path.join(repositoryRoot, "test", "salesforce");

class SalesforceApexBindSmoke extends Command {
  static description =
    "Run the static-Apex bind-expression smoke fixture against an authenticated Salesforce org.";

  static flags = {
    help: Flags.help({ char: "h" }),
    "target-org": Flags.string({
      description: "Salesforce org alias (default: KYSOQL_TARGET_ORG or kysoql-test).",
      helpValue: "<alias>",
    }),
  };

  static summary = "Run the Salesforce Apex bind smoke fixture.";

  async run(): Promise<void> {
    const { flags } = await this.parse(SalesforceApexBindSmoke);
    const environment = readSalesforceTargetEnvironment();
    const targetOrg = flags["target-org"] ?? environment.KYSOQL_TARGET_ORG;

    requireCommand("pnpm");
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
  }
}

try {
  await SalesforceApexBindSmoke.run(
    process.argv.slice(2),
    repositoryCommandLoadOptions,
  );
} catch (error) {
  console.error(
    errorLine(error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
}
