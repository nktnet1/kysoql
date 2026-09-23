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
    const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(
      `${command} exited with status ${result.status ?? "unknown"}${stderr ? `\n${stderr}` : ""}`,
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

export function requireNode26(): void {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  if (major !== 26) {
    throw new Error(`Node.js 26 is required; found ${process.version}`);
  }
}

export function parseJson<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON.`, { cause: error });
  }
}
