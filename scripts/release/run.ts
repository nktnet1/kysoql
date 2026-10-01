import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  forwardedArgs,
  requireCommand,
  requireSupportedNode,
  run,
} from "../lib/command.ts";
import {
  parseReleaseVersion,
  RELEASE_PACKAGES,
  releaseTag,
} from "./policy.ts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const VERSIONED_MANIFESTS = [
  "package.json",
  ...RELEASE_PACKAGES.map(
    (definition) => `${definition.workspacePath}/package.json`,
  ),
] as const;

type MutableJsonObject = Record<string, unknown>;

const readManifest = async (
  relativePath: string,
): Promise<MutableJsonObject> => {
  const source = await readFile(resolve(ROOT_DIR, relativePath), "utf8");
  const parsed: unknown = JSON.parse(source);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${relativePath} must contain a JSON object`);
  }
  return parsed as MutableJsonObject;
};

const writeVersion = async (
  relativePath: string,
  version: string,
): Promise<string> => {
  const manifest = await readManifest(relativePath);
  if (typeof manifest.version !== "string") {
    throw new Error(`${relativePath} must contain a string version`);
  }
  manifest.version = version;
  const source = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(resolve(ROOT_DIR, relativePath), source, "utf8");
  return source;
};

const git = (args: readonly string[]): string =>
  run("git", args, { cwd: ROOT_DIR, capture: true }).trim();

const assertCleanWorktree = (): void => {
  if (git(["status", "--porcelain"]).length !== 0) {
    throw new Error(
      "Commit or stash existing changes before preparing a release",
    );
  }
};

const assertExpectedChanges = (): void => {
  const changed = git(["status", "--porcelain"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3))
    .sort();
  const expected = [...VERSIONED_MANIFESTS].sort();
  if (
    changed.length !== expected.length ||
    expected.some((path, index) => path !== changed[index])
  ) {
    throw new Error(
      "Expected only release manifests to change; found: " +
        (changed.join(", ") || "none"),
    );
  }
};

const verifyPreparedManifests = async (
  expectedSources: ReadonlyMap<string, string>,
): Promise<void> => {
  for (const [relativePath, expectedSource] of expectedSources) {
    const actualSource = await readFile(
      resolve(ROOT_DIR, relativePath),
      "utf8",
    );
    if (actualSource !== expectedSource) {
      throw new Error(
        `${relativePath} changed during release validation; review before ` +
          "publishing",
      );
    }
  }
};

const { values } = parseArgs({
  args: forwardedArgs(),
  options: {
    version: { type: "string" },
    publish: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const main = async (): Promise<void> => {
  if (values.help) {
    console.log(`Usage:
  pnpm release --version <semver> [--dry-run | --publish]

Updates the root and five public @kysoql package versions together, runs the
full release gate, and leaves the version changes ready to commit.

--dry-run  Validate and print the tag/registry dist-tag without changing files.
--publish  Commit the validated manifests, create an annotated v<version> tag,
           and atomically push the current branch and tag to origin.

Supported versions are stable x.y.z and beta x.y.z-beta.n releases.`);
    return;
  }

  const version = values.version;
  if (version === undefined) {
    throw new Error("--version is required");
  }
  if (values.publish && values["dry-run"]) {
    throw new Error("Choose either --publish or --dry-run");
  }

  const parsedVersion = parseReleaseVersion(version);
  const tag = releaseTag(version);
  if (values["dry-run"]) {
    console.log(`${tag} -> registry dist-tag ${parsedVersion.distTag}`);
    for (const definition of RELEASE_PACKAGES) {
      console.log(`${definition.name}@${version}`);
    }
    return;
  }

  requireSupportedNode();
  requireCommand("git");
  requireCommand("pnpm");
  assertCleanWorktree();
  const branch = git(["symbolic-ref", "--short", "HEAD"]);
  if (branch.length === 0) {
    throw new Error("Release preparation requires a named Git branch");
  }
  if (git(["tag", "--list", tag]).length !== 0) {
    throw new Error(`Git tag already exists locally: ${tag}`);
  }

  const rootManifest = await readManifest("package.json");
  if (rootManifest.version === version) {
    throw new Error(`Workspace is already version ${version}`);
  }

  const preparedSources = new Map(
    await Promise.all(
      VERSIONED_MANIFESTS.map(async (relativePath) => [
        relativePath,
        await writeVersion(relativePath, version),
      ] as const),
    ),
  );
  console.log(
    `Prepared ${RELEASE_PACKAGES.length} @kysoql packages for ${tag}`,
  );

  run("pnpm", ["release:check"], { cwd: ROOT_DIR });
  await verifyPreparedManifests(preparedSources);
  assertExpectedChanges();

  if (!values.publish) {
    console.log(
      `Release ${tag} passed validation. Commit the version manifests and ` +
        `tag that commit as ${tag}.`,
    );
    return;
  }

  const remoteTag = git([
    "ls-remote",
    "--tags",
    "--refs",
    "origin",
    `refs/tags/${tag}`,
  ]);
  if (remoteTag.length !== 0) {
    throw new Error(`Git tag already exists on origin: ${tag}`);
  }
  await verifyPreparedManifests(preparedSources);
  assertExpectedChanges();

  run("git", ["add", "--", ...VERSIONED_MANIFESTS], { cwd: ROOT_DIR });
  run("git", ["commit", "-m", tag], { cwd: ROOT_DIR });
  run("git", ["tag", "-a", tag, "-m", tag], { cwd: ROOT_DIR });
  run(
    "git",
    [
      "push",
      "--atomic",
      "origin",
      `HEAD:refs/heads/${branch}`,
      `refs/tags/${tag}`,
    ],
    { cwd: ROOT_DIR },
  );

  console.log(
    `Pushed ${tag}. GitHub Actions will build, validate, and publish the ` +
      "release packages.",
  );
};

await main();
