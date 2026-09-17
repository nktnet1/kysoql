#!/usr/bin/env node

import { Connection } from "jsforce";

import { cliUsage, parseCli } from "./cli-options.js";
import { generateSchema } from "./index.js";
import type {
  SalesforceGlobalDescription,
  SalesforceObjectDescription,
} from "./types.js";
import { parseRequiredEnvironmentVariable } from "./validation.js";

const requiredEnvironmentVariable = (name: string): string =>
  parseRequiredEnvironmentVariable(process.env[name], name);

const main = async (): Promise<void> => {
  const command = parseCli(process.argv.slice(2));
  if (command.kind === "help") {
    console.log(cliUsage);
    return;
  }

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
    objects: command.options.objects,
    output: command.options.output,
    schemaName: command.options.schemaName,
  });

  console.log(`Generated ${command.options.output}`);
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
