import { Command, Flags } from "@oclif/core";
import { Connection } from "jsforce";

import { generateSchema } from "#/index";
import type {
  SalesforceGlobalDescription,
  SalesforceObjectDescription,
} from "#/types";
import {
  parseRequiredEnvironmentVariable,
  parseSchemaName,
} from "#/validation";

const requiredEnvironmentVariable = (name: string): string =>
  parseRequiredEnvironmentVariable(process.env[name], name);

export default class Generate extends Command {
  static description =
    `Generate a strongly typed Salesforce schema from Describe metadata.

Authentication requires the SF_INSTANCE_URL and SF_ACCESS_TOKEN environment variables.`;

  static examples = [
    `<%= config.bin %> <%= command.id %> --object Account --object Contact --output src/salesforce.generated.ts`,
  ];

  static flags = {
    object: Flags.string({
      description: "Salesforce object API name to include. Repeat as needed.",
      helpValue: "<api-name>",
      multiple: true,
      multipleNonGreedy: true,
    }),
    output: Flags.string({
      default: "salesforce.generated.ts",
      description: "Generated TypeScript file.",
      helpValue: "<path>",
    }),
    "schema-name": Flags.string({
      default: "SalesforceSchema",
      description: "Generated schema interface name.",
      helpValue: "<name>",
    }),
  };

  static summary = "Generate a TypeScript schema from Salesforce.";

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    const schemaName = parseSchemaName(flags["schema-name"]);
    const connection = new Connection({
      accessToken: requiredEnvironmentVariable("SF_ACCESS_TOKEN"),
      instanceUrl: requiredEnvironmentVariable("SF_INSTANCE_URL"),
    });

    await generateSchema({
      client: {
        describeGlobal: async () =>
          (await connection.describeGlobal()) as unknown as SalesforceGlobalDescription,
        describe: async (objectName) =>
          (await connection.describe(
            objectName,
          )) as unknown as SalesforceObjectDescription,
      },
      objects: flags.object ?? [],
      output: flags.output,
      schemaName,
    });

    this.log(`Generated ${flags.output}`);
  }
}
