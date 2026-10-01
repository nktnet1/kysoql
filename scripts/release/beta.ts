import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  parseJson,
  requireCommand,
  requireSupportedNode,
  run,
} from "../lib/command.ts";
import { nextBetaVersion } from "./beta-version.ts";
import { parseReleaseVersion, RELEASE_PACKAGES } from "./policy.ts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

interface RootManifest {
  readonly version?: unknown;
}

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    publish: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    registry: { type: "string", default: DEFAULT_REGISTRY },
    help: { type: "boolean", short: "h", default: false },
  },
});

const npmVersions = (packageName: string, registry: string): string[] => {
  const output = run(
    "npm",
    ["view", packageName, "versions", "--json", `--registry=${registry}`],
    { cwd: ROOT_DIR, capture: true },
  );
  const parsed = parseJson<unknown>(output, `npm view ${packageName}`);
  const versions = typeof parsed === "string" ? [parsed] : parsed;
  if (
    !Array.isArray(versions) ||
    !versions.every((version) => typeof version === "string")
  ) {
    throw new Error(`Invalid npm version list for ${packageName}`);
  }
  return versions;
};

const git = (args: readonly string[]): string =>
  run("git", args, { cwd: ROOT_DIR, capture: true }).trim();

const chooseBase = (
  requested: string | undefined,
  current: string,
  published: ReadonlySet<string>,
): string => {
  if (requested !== undefined) {
    const parsed = parseReleaseVersion(requested);
    if (parsed.beta !== undefined) {
      throw new Error("--base must be a stable x.y.z version");
    }
    return parsed.base;
  }

  const parsedCurrent = parseReleaseVersion(current);
  if (parsedCurrent.beta !== undefined) {
    return parsedCurrent.base;
  }
  if (current !== "0.0.0" && !published.has(current)) {
    return parsedCurrent.base;
  }
  throw new Error(
    "Unable to infer the next beta base. Pass --base <x.y.z>, for example " +
      "--base 0.2.0.",
  );
};

const printHelp = (): void => {
  console.log(`Usage:
  pnpm release:beta -- --base <x.y.z> --dry-run
  pnpm release:beta -- --base <x.y.z> --publish
  pnpm release:beta -- --publish

Selects the next unused numbered beta from npm versions plus local/remote Git
tags, then delegates to the normal release command.

For the first beta of a new release line, pass --base once, for example 0.2.0.
After a beta is prepared/published, the base can be inferred from the current
x.y.z-beta.n manifest version.

--dry-run  Print the selected beta and release plan without changing files.
--publish  Run release checks, commit all version manifests, create the annotated
           v<version> tag, and atomically push the branch and tag to origin.

Registry/network errors abort beta selection rather than being treated as an
empty version list. Bootstrap the @kysoql package names and configure npm trusted
publishing before the first real beta release.`);
};

const main = async (): Promise<void> => {
  if (values.help) {
    printHelp();
    return;
  }
  if (values.publish && values["dry-run"]) {
    throw new Error("Choose either --publish or --dry-run");
  }

  requireSupportedNode();
  requireCommand("git");
  requireCommand("npm");

  const manifest = JSON.parse(
    await readFile(resolve(ROOT_DIR, "package.json"), "utf8"),
  ) as RootManifest;
  if (typeof manifest.version !== "string") {
    throw new Error("Root package.json must contain a string version");
  }

  const registry = values.registry ?? DEFAULT_REGISTRY;
  const published = new Set<string>();
  for (const definition of RELEASE_PACKAGES) {
    for (const version of npmVersions(definition.name, registry)) {
      published.add(version);
    }
  }

  const localTags = git(["tag", "--list"])
    .split("\n")
    .filter(Boolean);
  const remoteTags = git(["ls-remote", "--tags", "--refs", "origin"])
    .split("\n")
    .map((line) => line.split("refs/tags/")[1] ?? "")
    .filter(Boolean);

  const base = chooseBase(values.base, manifest.version, published);
  const version = nextBetaVersion(base, manifest.version, [...published], [
    ...localTags,
    ...remoteTags,
  ]);
  console.log(`${manifest.version} -> ${version} (npm dist-tag: beta)`);

  const args = [
    "--experimental-strip-types",
    resolve(ROOT_DIR, "scripts/release/run.ts"),
    "--version",
    version,
  ];
  if (values["dry-run"]) {
    args.push("--dry-run");
  }
  if (values.publish) {
    args.push("--publish");
  }
  run(process.execPath, args, { cwd: ROOT_DIR });
};

await main();
