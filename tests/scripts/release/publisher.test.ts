import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { afterEach, expect, it, vi } from "vitest";

import { RELEASE_PACKAGES } from "#scripts/release/policy";
import { publishReleasePackages } from "#scripts/release/publisher";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));

const writeTarball = (file: string, manifest: object): void => {
  const payload = Buffer.from(JSON.stringify(manifest));
  const header = Buffer.alloc(512);
  header.write("package/package.json", 0, "utf8");
  header.write(
    `${payload.length.toString(8).padStart(11, "0")}\0`,
    124,
    "ascii",
  );
  header[156] = "0".charCodeAt(0);
  const padding = Buffer.alloc((512 - (payload.length % 512)) % 512);
  writeFileSync(
    file,
    gzipSync(Buffer.concat([header, payload, padding, Buffer.alloc(1024)])),
  );
};

let rootDirectory: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  if (rootDirectory !== undefined) {
    rmSync(rootDirectory, { recursive: true, force: true });
  }
  rootDirectory = undefined;
});

const createRelease = (
  version: string,
  mutate?: (
    packageName: string,
    manifest: Record<string, unknown>,
  ) => void,
): Map<string, string> => {
  rootDirectory = mkdtempSync(join(tmpdir(), "kysoql-release-test-"));
  const directory = join(rootDirectory, "release-packages");
  mkdirSync(directory);
  const files = new Map<string, string>();

  for (const [index, definition] of RELEASE_PACKAGES.entries()) {
    const manifest: Record<string, unknown> = {
      name: definition.name,
      version,
      dependencies: Object.fromEntries(
        definition.internalDependencies.map((name) => [name, version]),
      ),
    };
    mutate?.(definition.name, manifest);
    const file = join(directory, `${index}.tgz`);
    writeTarball(file, manifest);
    files.set(definition.name, file);
  }

  return files;
};

it.each([
  ["1.2.3", "latest"],
  ["1.2.3-beta.2", "beta"],
] as const)("publishes a complete %s release to %s", (version, distTag) => {
  createRelease(version);
  const calls: string[][] = [];
  mocks.spawn.mockImplementation((command: string, args: string[]) => {
    expect(command).toBe("pnpm");
    calls.push(args);
    if (args[0] === "--version") {
      return { status: 0, stdout: "12.6.0\n", stderr: "" };
    }
    if (args[0] === "view") {
      return {
        status: 1,
        stdout: '{"error":{"code":"E404"}}',
        stderr: "",
      };
    }
    expect(args[0]).toBe("publish");
    return { status: 0, stdout: "", stderr: "" };
  });

  publishReleasePackages({
    root: rootDirectory as string,
    registry: "https://registry.npmjs.org",
    tag: `v${version}`,
  });

  const publishes = calls.filter((args) => args[0] === "publish");
  expect(publishes).toHaveLength(RELEASE_PACKAGES.length);
  for (const command of publishes) {
    expect(command).toContain("--access");
    expect(command).toContain("public");
    expect(command).toContain("--ignore-scripts");
    expect(command.slice(-2)).toEqual(["--tag", distTag]);
  }
});

it("skips an identical package version during a safe retry", () => {
  const version = "1.2.3";
  const files = createRelease(version);
  const alreadyPublished = RELEASE_PACKAGES[0];
  const existingFile = files.get(alreadyPublished.name);
  if (existingFile === undefined) {
    throw new Error("Missing release fixture");
  }
  const integrity = `sha512-${createHash("sha512")
    .update(readFileSync(existingFile))
    .digest("base64")}`;

  const publishes: string[][] = [];
  mocks.spawn.mockImplementation((command: string, args: string[]) => {
    expect(command).toBe("pnpm");
    if (args[0] === "--version") {
      return { status: 0, stdout: "12.6.0\n", stderr: "" };
    }
    if (args[0] === "view") {
      if (args[1] === `${alreadyPublished.name}@${version}`) {
        return {
          status: 0,
          stdout: JSON.stringify(integrity),
          stderr: "",
        };
      }
      return {
        status: 1,
        stdout: '{"error":{"code":"E404"}}',
        stderr: "",
      };
    }
    if (args[0] === "publish") {
      publishes.push(args);
      return { status: 0, stdout: "", stderr: "" };
    }
    throw new Error(`Unexpected pnpm action: ${String(args[0])}`);
  });

  publishReleasePackages({
    root: rootDirectory as string,
    registry: "https://registry.npmjs.org",
    tag: `v${version}`,
  });

  expect(publishes).toHaveLength(RELEASE_PACKAGES.length - 1);
});

it.each(["conflict", "network", "bad-sha"] as const)(
  "fails before publishing on %s",
  (mode) => {
    const version = "1.2.3";
    createRelease(version);
    if (rootDirectory === undefined) {
      throw new Error("Missing release fixture");
    }

    const options = {
      root: rootDirectory,
      registry: "https://registry.npmjs.org",
      tag: `v${version}` as string | undefined,
      expectedSha: undefined as string | undefined,
    };
    if (mode === "bad-sha") {
      const metadata = join(rootDirectory, "release-metadata");
      mkdirSync(metadata);
      writeFileSync(join(metadata, "sha"), `${"a".repeat(40)}\n`);
      writeFileSync(join(metadata, "tag"), `v${version}\n`);
      options.tag = undefined;
      options.expectedSha = "b".repeat(40);
    }

    let publishCalls = 0;
    mocks.spawn.mockImplementation((command: string, args: string[]) => {
      expect(command).toBe("pnpm");
      if (args[0] === "--version") {
        return { status: 0, stdout: "12.6.0\n", stderr: "" };
      }
      if (args[0] === "view") {
        if (mode === "network") {
          return {
            status: 1,
            stdout: '{"error":{"code":"E503"}}',
            stderr: "registry unavailable",
          };
        }
        return {
          status: 0,
          stdout: JSON.stringify("sha512-different"),
          stderr: "",
        };
      }
      if (args[0] === "publish") {
        publishCalls += 1;
        return { status: 0, stdout: "", stderr: "" };
      }
      throw new Error(`Unexpected pnpm action: ${String(args[0])}`);
    });

    expect(() =>
      publishReleasePackages({
        root: options.root,
        registry: options.registry,
        ...(options.tag === undefined ? {} : { tag: options.tag }),
        ...(options.expectedSha === undefined
          ? {}
          : { expectedSha: options.expectedSha }),
      }),
    ).toThrow();
    expect(publishCalls).toBe(0);
  },
);

it("validates tarballs without contacting the registry in dry-run mode", () => {
  const version = "1.2.3-beta.1";
  createRelease(version);
  vi.spyOn(console, "log").mockImplementation(() => undefined);

  publishReleasePackages({
    root: rootDirectory as string,
    registry: "https://registry.npmjs.org",
    tag: `v${version}`,
    dryRun: true,
  });

  expect(mocks.spawn).not.toHaveBeenCalled();
});
