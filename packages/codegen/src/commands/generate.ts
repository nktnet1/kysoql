import { DEFAULT_API_VERSION } from "@kysoql/rest";
import { Command, Flags } from "@oclif/core";

import {
  loadConfig,
  parseKysoqlConfig,
  resolveGenerateOptions,
} from "#/config-loader";
import { generateSchema } from "#/index";
import { createRestDescribeClient } from "#/rest-client";
import { parseGenerateEnvironment } from "#/validation";

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
    help: Flags.help({ char: "h" }),
    "api-version": Flags.string({
      description:
        "Salesforce REST version, without v (flag > config > SF_API_VERSION > 65.0).",
      helpValue: "<version>",
    }),
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
    const environment = parseGenerateEnvironment(process.env);
    const loaded = await loadConfig({
      configFile: flags.config,
      disabled: flags["no-config"],
    });
    const { apiVersion, ...options } = resolveGenerateOptions(flags, loaded);
    const version = parseKysoqlConfig({
      apiVersion:
        apiVersion ?? environment.SF_API_VERSION ?? DEFAULT_API_VERSION,
    }).apiVersion;
    const client = createRestDescribeClient({
      accessToken: environment.SF_ACCESS_TOKEN,
      instanceUrl: environment.SF_INSTANCE_URL,
      ...(version === undefined ? {} : { apiVersion: version }),
    });

    await generateSchema({ client, ...options });

    this.log(`Generated ${options.output}`);
  }
}
