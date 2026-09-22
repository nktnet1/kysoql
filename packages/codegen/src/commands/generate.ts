import { Command, Flags } from "@oclif/core";
import { Connection } from "jsforce";

import { loadConfig, resolveGenerateOptions } from "#/config-loader";
import { generateSchema } from "#/index";
import type {
  SalesforceDataCategoryGroupsResponse,
  SalesforceGlobalDescription,
  SalesforceObjectDescription,
} from "#/types";
import { parseRequiredEnvironmentVariable } from "#/validation";

const requiredEnvironmentVariable = (name: string): string =>
  parseRequiredEnvironmentVariable(process.env[name], name);

export default class Generate extends Command {
  static description =
    `Generate a strongly typed Salesforce schema from Describe metadata.

Loads kysoql.config.ts (or another supported JS/TS extension) from the current directory.
Use config fields to include or exclude exact field API names per object.
CLI flags override configuration. Authentication requires SF_INSTANCE_URL and SF_ACCESS_TOKEN.`;

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --config config/kysoql.sandbox.ts`,
    `<%= config.bin %> <%= command.id %> --object Account --object Contact --output src/salesforce.generated.ts`,
  ];

  static flags = {
    config: Flags.string({
      description: "Configuration file, relative to the current directory.",
      helpValue: "<path>",
      exclusive: ["no-config"],
    }),
    "no-config": Flags.boolean({
      description: "Disable configuration discovery and use only CLI options.",
      exclusive: ["config"],
    }),
    object: Flags.string({
      description: "Salesforce object API name to include. Repeat as needed.",
      helpValue: "<api-name>",
      multiple: true,
      multipleNonGreedy: true,
    }),
    output: Flags.string({
      description:
        "Generated TypeScript file (default: salesforce.generated.ts unless configured).",
      helpValue: "<path>",
    }),
    "schema-name": Flags.string({
      description:
        "Generated schema interface name (default: SalesforceSchema unless configured).",
      helpValue: "<name>",
    }),
  };

  static summary = "Generate a TypeScript schema from Salesforce.";

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    const loaded = await loadConfig({
      configFile: flags.config,
      disabled: flags["no-config"],
    });
    const options = resolveGenerateOptions(flags, loaded);
    const connection = new Connection({
      accessToken: requiredEnvironmentVariable("SF_ACCESS_TOKEN"),
      instanceUrl: requiredEnvironmentVariable("SF_INSTANCE_URL"),
    });
    let knowledgeDataCategoryGroups:
      | Promise<SalesforceDataCategoryGroupsResponse>
      | undefined;
    const loadKnowledgeDataCategoryGroups =
      (): Promise<SalesforceDataCategoryGroupsResponse> => {
        knowledgeDataCategoryGroups ??= Promise.resolve(
          connection.request<SalesforceDataCategoryGroupsResponse>(
            "/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion&topCategoriesOnly=false",
          ),
        );
        return knowledgeDataCategoryGroups;
      };

    await generateSchema({
      client: {
        describeGlobal: async () =>
          (await connection.describeGlobal()) as unknown as SalesforceGlobalDescription,
        describe: async (objectName) =>
          (await connection.describe(
            objectName,
          )) as unknown as SalesforceObjectDescription,
        describeDataCategoryGroups: async (objectName) => {
          if (
            objectName !== "KnowledgeArticleVersion" &&
            !objectName.endsWith("__kav")
          ) {
            return undefined;
          }

          return loadKnowledgeDataCategoryGroups();
        },
      },
      ...options,
    });

    this.log(`Generated ${options.output}`);
  }
}
