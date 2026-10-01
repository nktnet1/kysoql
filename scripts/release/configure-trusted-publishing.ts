import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";

import {
  forwardedArgs,
  parseJson,
  requireCommand,
  run,
} from "#scripts/lib/command";
import { accent, strong, success, warning } from "#scripts/lib/output";
import { RELEASE_PACKAGES } from "#scripts/release/policy";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const REPOSITORY = "nktnet1/kysoql";
const WORKFLOW = "publish.yaml";
const ENVIRONMENT = "Production";
const MINIMUM_NPM_VERSION = [11, 15, 0] as const;

const { values } = parseArgs({
  args: forwardedArgs(),
  options: {
    registry: { type: "string", default: DEFAULT_REGISTRY },
    help: { type: "boolean", short: "h", default: false },
  },
});

const registry = values.registry ?? DEFAULT_REGISTRY;
const registryUrl = new URL(registry);
if (
  !["https:", "http:"].includes(registryUrl.protocol) ||
  registryUrl.username ||
  registryUrl.password
) {
  throw new Error(
    "Registry must be an HTTP(S) URL without embedded credentials",
  );
}

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

const parseVersion = (value: string): readonly number[] => {
  const parts = value
    .trim()
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.some(Number.isNaN)) {
    throw new Error(`Unable to parse npm version: ${value.trim()}`);
  }
  return parts;
};

const requireSupportedNpm = (): void => {
  requireCommand("npm");
  const version = run("npm", ["--version"], { capture: true }).trim();
  if (compareVersion(parseVersion(version), MINIMUM_NPM_VERSION) < 0) {
    throw new Error(
      `npm >=${MINIMUM_NPM_VERSION.join(".")} is required for trusted-publisher setup; found ${version}`,
    );
  }
};

const collectStrings = (value: unknown, output: Set<string>): void => {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, output);
    }
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(
      value as Readonly<Record<string, unknown>>,
    )) {
      collectStrings(item, output);
    }
  }
};

const hasDesiredTrust = (value: unknown): boolean => {
  const strings = new Set<string>();
  collectStrings(value, strings);
  return (
    strings.has(REPOSITORY) && strings.has(WORKFLOW) && strings.has(ENVIRONMENT)
  );
};

const listTrust = (packageName: string): unknown | undefined => {
  try {
    const raw = run(
      "npm",
      ["trust", "list", packageName, "--json", "--registry", registry],
      { capture: true },
    ).trim();
    return raw.length === 0
      ? undefined
      : parseJson<unknown>(raw, "npm trust list");
  } catch {
    // The create command below owns the supported interactive authentication flow.
    return undefined;
  }
};

const configureTrust = (packageName: string): void => {
  const existing = listTrust(packageName);
  if (existing !== undefined && hasDesiredTrust(existing)) {
    console.log(
      `${success("SKIP")} ${accent(packageName)} already trusts ${accent(WORKFLOW)}`,
    );
    return;
  }

  console.log(
    `${warning("CONFIGURE")} ${accent(packageName)} via ${strong("npm trust github")}`,
  );
  run("npm", [
    "trust",
    "github",
    packageName,
    "--file",
    WORKFLOW,
    "--repo",
    REPOSITORY,
    "--environment",
    ENVIRONMENT,
    "--allow-publish",
    "--yes",
    "--registry",
    registry,
  ]);
  console.log(`${success("CONFIGURED")} ${accent(packageName)}`);
};

const printHelp = (): void => {
  console.log(`${strong("Usage:")}
  ${accent("pnpm oidc:trust")} [--registry <url>]

Configures the GitHub Actions trusted publisher for every @kysoql package.
This wrapper intentionally uses the official npm trust command because pnpm does
not expose the package-governance API required to create trusted publishers.
Normal install, build, pack, beta, and release orchestration remains pnpm-based.
The GitHub Actions publish job uses npm itself for the trusted-publishing OIDC
exchange.

Publisher:
  repository:  ${REPOSITORY}
  workflow:    ${WORKFLOW}
  environment: ${ENVIRONMENT}
  permission:  direct publish

Requirements:
  npm >=${MINIMUM_NPM_VERSION.join(".")}
  write access to each package
  account-level 2FA enabled

The first configuration can open npm's interactive 2FA/browser authorization.
Choose the five-minute 2FA skip option when offered so the remaining packages can
be configured in the same session.`);
};

const main = async (): Promise<void> => {
  if (values.help) {
    printHelp();
    return;
  }

  requireSupportedNpm();

  for (const [index, definition] of RELEASE_PACKAGES.entries()) {
    configureTrust(definition.name);
    if (index < RELEASE_PACKAGES.length - 1) {
      await setTimeout(2_000);
    }
  }
};

await main();
