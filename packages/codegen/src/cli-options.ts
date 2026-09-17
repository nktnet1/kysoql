export interface GenerateCliOptions {
  readonly output: string;
  readonly objects: readonly string[];
  readonly schemaName: string;
}

export type CliCommand =
  | { readonly kind: "generate"; readonly options: GenerateCliOptions }
  | { readonly kind: "help" };

const usage = `Usage: kysoql generate [options]

Options:
  --output <path>       Generated TypeScript file (default: salesforce.generated.ts)
  --object <api-name>   Include an object. Repeat to include multiple objects.
  --schema-name <name>  Generated schema interface name (default: SalesforceSchema)
  --help                Show this help message

Authentication environment variables:
  SF_INSTANCE_URL
  SF_ACCESS_TOKEN
`;

export const cliUsage = usage;

const readValue = (
  args: readonly string[],
  index: number,
  flag: string,
): string => {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

export const parseCli = (args: readonly string[]): CliCommand => {
  if (args.length === 0 || args.includes("--help")) {
    return { kind: "help" };
  }

  const [command, ...rawRest] = args;
  if (command !== "generate") {
    throw new Error(`Unknown command: ${command ?? ""}`);
  }

  const rest = rawRest[0] === "--" ? rawRest.slice(1) : rawRest;

  let output = "salesforce.generated.ts";
  let schemaName = "SalesforceSchema";
  const objects: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    switch (argument) {
      case "--object":
        objects.push(readValue(rest, index, argument));
        index += 1;
        break;
      case "--output":
        output = readValue(rest, index, argument);
        index += 1;
        break;
      case "--schema-name":
        schemaName = readValue(rest, index, argument);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${argument ?? ""}`);
    }
  }

  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(schemaName)) {
    throw new Error(`Invalid schema name: ${schemaName}`);
  }

  return {
    kind: "generate",
    options: { objects, output, schemaName },
  };
};
