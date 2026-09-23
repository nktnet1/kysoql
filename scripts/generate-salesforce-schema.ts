import { Command, Flags } from "@oclif/core";

import {
  parseJson,
  requireCommand,
  requireNode26,
  run,
} from "./lib/command.ts";
import { readSchemaGenerationEnvironment } from "./lib/environment.ts";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "./lib/oclif.ts";

interface OrgDisplayResponse {
  readonly status: number;
  readonly result?: {
    readonly instanceUrl?: string;
  };
}

interface AccessTokenResponse {
  readonly status: number;
  readonly result?: {
    readonly accessToken?: string;
  };
}

class GenerateSalesforceSchema extends Command {
  static description =
    "Build @kysoql/codegen and generate the Salesforce schema using explicit credentials or an authenticated Salesforce CLI org.";

  static flags = {
    help: Flags.help({ char: "h" }),
    "api-version": Flags.string({
      description: "Salesforce REST version, without v.",
      helpValue: "<version>",
    }),
    config: Flags.string({
      description: "Configuration file passed to kysoql generate.",
      helpValue: "<path>",
      exclusive: ["no-config"],
    }),
    "no-config": Flags.boolean({
      description: "Disable Kysoql configuration discovery.",
      exclusive: ["config"],
    }),
    object: Flags.string({
      description: "Salesforce object API name to include. Repeat as needed.",
      helpValue: "<api-name>",
      multiple: true,
      multipleNonGreedy: true,
    }),
    output: Flags.string({
      description: "Generated TypeScript output file.",
      helpValue: "<path>",
    }),
    "schema-name": Flags.string({
      description: "Generated schema interface name.",
      helpValue: "<name>",
    }),
  };

  static summary = "Generate the Salesforce schema for repository fixtures.";

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateSalesforceSchema);
    const environment = readSchemaGenerationEnvironment();

    requireNode26();
    requireCommand("pnpm");
    run(
      "pnpm",
      ["exec", "turbo", "run", "build", "--filter=@kysoql/codegen"],
      { cwd: repositoryRoot },
    );

    let accessToken = environment.SF_ACCESS_TOKEN;
    let instanceUrl = environment.SF_INSTANCE_URL;
    if (accessToken === undefined || instanceUrl === undefined) {
      const targetOrg =
        environment.KYSOQL_TARGET_ORG ??
        environment.KYSOQL_SCRATCH_ALIAS ??
        "kysoql-test";
      const org = parseJson<OrgDisplayResponse>(
        run(
          "pnpm",
          ["sf", "org", "display", "--target-org", targetOrg, "--json"],
          { cwd: repositoryRoot, capture: true },
        ),
        "Salesforce org display",
      );
      const token = parseJson<AccessTokenResponse>(
        run(
          "pnpm",
          [
            "sf",
            "org",
            "auth",
            "show-access-token",
            "--target-org",
            targetOrg,
            "--json",
          ],
          { cwd: repositoryRoot, capture: true },
        ),
        "Salesforce access token",
      );
      if (org.status !== 0 || org.result?.instanceUrl === undefined) {
        throw new Error("Salesforce CLI did not return instanceUrl.");
      }
      if (token.status !== 0 || token.result?.accessToken === undefined) {
        throw new Error("Salesforce CLI did not return accessToken.");
      }
      instanceUrl = org.result.instanceUrl;
      accessToken = token.result.accessToken;
    }

    const forwardedArgs: string[] = ["generate"];
    if (flags["api-version"] !== undefined) {
      forwardedArgs.push("--api-version", flags["api-version"]);
    }
    if (flags.config !== undefined) {
      forwardedArgs.push("--config", flags.config);
    }
    if (flags["no-config"] === true) {
      forwardedArgs.push("--no-config");
    }
    for (const objectName of flags.object ?? []) {
      forwardedArgs.push("--object", objectName);
    }
    if (flags.output !== undefined) {
      forwardedArgs.push("--output", flags.output);
    }
    if (flags["schema-name"] !== undefined) {
      forwardedArgs.push("--schema-name", flags["schema-name"]);
    }

    run(process.execPath, ["packages/codegen/dist/cli.mjs", ...forwardedArgs], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        SF_INSTANCE_URL: instanceUrl,
        SF_ACCESS_TOKEN: accessToken,
      },
    });
  }
}

const argv = process.argv.slice(2);
if (argv[0] === "--") {
  argv.shift();
}

try {
  await GenerateSalesforceSchema.run(argv, repositoryCommandLoadOptions);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
