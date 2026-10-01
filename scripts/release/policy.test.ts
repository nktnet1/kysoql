import { expect, it } from "vitest";

import {
  parseReleaseVersion,
  planRelease,
  RELEASE_PACKAGES,
  releaseTag,
  versionFromReleaseTag,
  type ReleaseArtifact,
} from "./policy.ts";

const VERSION = "1.2.3-beta.4";

const fixture = (): ReleaseArtifact[] =>
  RELEASE_PACKAGES.map((definition, index) => ({
    file: `${index}.tgz`,
    manifest: {
      name: definition.name,
      version: VERSION,
      dependencies: Object.fromEntries(
        definition.internalDependencies.map((name) => [name, VERSION]),
      ),
    },
  }));

const replaceManifest = (
  artifacts: ReleaseArtifact[],
  index: number,
  changes: Readonly<Record<string, unknown>>,
): void => {
  const artifact = artifacts[index];
  if (artifact === undefined) {
    throw new Error(`Missing release fixture at index ${index}`);
  }
  artifacts[index] = {
    ...artifact,
    manifest: { ...artifact.manifest, ...changes },
  };
};

it.each([
  ["1.2.3", "latest"],
  ["1.2.3-beta.0", "beta"],
  ["1.2.3-beta.12", "beta"],
] as const)("maps %s to npm dist-tag %s", (version, distTag) => {
  expect(parseReleaseVersion(version).distTag).toBe(distTag);
  expect(releaseTag(version)).toBe(`v${version}`);
  expect(versionFromReleaseTag(`v${version}`)).toBe(version);
});

it.each([
  "1.2.3-rc.1",
  "1.2.3-beta.01",
  "01.2.3",
  "1x2x3",
  "1.2.3+build",
  "1.2.3\n",
])("rejects unsupported release version %s", (version) => {
  expect(() => parseReleaseVersion(version)).toThrow();
});

it("requires the v prefix on release tags", () => {
  expect(() => versionFromReleaseTag(VERSION)).toThrow();
});

it("orders the complete @kysoql release graph", () => {
  const artifacts = fixture().reverse();
  expect(
    planRelease(artifacts, VERSION).map(({ manifest }) => manifest.name),
  ).toEqual(RELEASE_PACKAGES.map(({ name }) => name));
});

it.each([
  "missing",
  "duplicate",
  "wrong-version",
  "wrong-scope",
  "workspace-dependency",
  "extra-internal-dependency",
  "private",
] as const)("rejects invalid release artifacts: %s", (mode) => {
  const artifacts = fixture();
  if (mode === "missing") {
    artifacts.pop();
  }
  if (mode === "duplicate") {
    const duplicate = artifacts[1];
    if (duplicate === undefined) {
      throw new Error("Missing duplicate fixture");
    }
    artifacts[0] = duplicate;
  }
  if (mode === "wrong-version") {
    replaceManifest(artifacts, 0, { version: "1.2.3" });
  }
  if (mode === "wrong-scope") {
    replaceManifest(artifacts, 0, { name: "@other/core" });
  }
  if (mode === "workspace-dependency") {
    const restIndex = artifacts.findIndex(
      ({ manifest }) => manifest.name === "@kysoql/rest",
    );
    replaceManifest(artifacts, restIndex, {
      dependencies: { "@kysoql/core": "workspace:*" },
    });
  }
  if (mode === "extra-internal-dependency") {
    replaceManifest(artifacts, 0, {
      dependencies: { "@kysoql/auth": VERSION },
    });
  }
  if (mode === "private") {
    replaceManifest(artifacts, 0, { private: true });
  }

  expect(() => planRelease(artifacts, VERSION)).toThrow();
});
