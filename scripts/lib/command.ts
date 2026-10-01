import { spawnSync } from "node:child_process";

export interface CommandOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly capture?: boolean;
  readonly quiet?: boolean;
}

function spawn(
  command: string,
  args: readonly string[],
  options: CommandOptions = {},
) {
  const capture = options.capture === true;
  const quiet = options.quiet === true;
  return spawnSync(command, [...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: capture
      ? ["ignore", "pipe", "pipe"]
      : quiet
        ? ["ignore", "ignore", "ignore"]
        : "inherit",
  });
}

export function run(
  command: string,
  args: readonly string[],
  options: CommandOptions = {},
): string {
  const result = spawn(command, args, options);
  if (result.error) {
    throw new Error(`Unable to execute ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const output = options.capture
      ? [result.stderr, result.stdout]
          .filter((value): value is string =>
            typeof value === "string" && value.trim().length > 0,
          )
          .map((value) => value.trim())
          .join("\n")
      : "";
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}` +
        (output ? `\n${output}` : ""),
    );
  }
  return typeof result.stdout === "string" ? result.stdout : "";
}

export function succeeds(
  command: string,
  args: readonly string[],
  options: CommandOptions = {},
): boolean {
  const result = spawn(command, args, { ...options, quiet: true });
  return !result.error && result.status === 0;
}

export function requireCommand(command: string): void {
  if (!succeeds(command, ["--version"])) {
    throw new Error(`required command not found: ${command}`);
  }
}

const MINIMUM_NODE_VERSION = [22, 12, 0] as const;

const compareVersion = (
  left: readonly number[],
  right: readonly number[],
): number => {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

export function requireSupportedNode(): void {
  const current = process.versions.node
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));
  if (
    current.some(Number.isNaN) ||
    compareVersion(current, MINIMUM_NODE_VERSION) < 0
  ) {
    throw new Error(
      `Node.js >=${MINIMUM_NODE_VERSION.join(".")} is required; found ${process.version}`,
    );
  }
}

export function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON.`, { cause: error });
  }
}

export function forwardedArgs(
  argv: readonly string[] = process.argv.slice(2),
): string[] {
  return argv[0] === "--" ? [...argv.slice(1)] : [...argv];
}
