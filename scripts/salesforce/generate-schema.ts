import { fileURLToPath } from "node:url";

import { Command, Flags } from "@oclif/core";

import { requireCommand, requireSupportedNode, run } from "#scripts/lib/command";
import { errorLine } from "#scripts/lib/output";
import {
  repositoryCommandLoadOptions,
  repositoryRoot,
} from "#scripts/lib/oclif";

class GenerateSalesforceSchema extends Command {
  static description =
    "Build @kysoql/codegen and generate the Salesforce schema using an authenticated Salesforce CLI org.";

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
    requireSupportedNode();
    requireCommand("pnpm");
    run(
      "pnpm",
      ["exec", "turbo", "run", "build", "--filter=@kysoql/codegen"],
      { cwd: repositoryRoot },
    );

    const authFile = new URL("../lib/salesforce-cli-auth.ts", import.meta.url);
    const forwardedArgs: string[] = [
      "generate",
      "--auth",
      fileURLToPath(authFile),
    ];
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
  console.error(
    errorLine(error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
}
