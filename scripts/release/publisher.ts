import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { run } from "#scripts/lib/command";
import { accent, success, warning } from "#scripts/lib/output";
import {
  parseReleaseVersion,
  planRelease,
  versionFromReleaseTag,
} from "#scripts/release/policy";
import { readPackageManifestFromTarball } from "#scripts/release/tarball";

const resolveNpmCli = (): string => {
  const nodeDirectory = dirname(realpathSync(process.execPath));
  const candidates = [
    resolve(
      nodeDirectory,
      "..",
      "lib",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
    resolve(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    resolve(nodeDirectory, "..", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  for (const candidate of candidates) {
    try {
      const canonical = realpathSync(candidate);
      if (lstatSync(canonical).isFile()) {
        return canonical;
      }
    } catch {
      // Try the next layout used by supported Node installations.
    }
  }
  throw new Error(
    `Unable to locate npm-cli.js next to the current Node.js executable: ${process.execPath}`,
  );
};

export interface PublishReleasePackagesOptions {
  readonly root: string;
  readonly registry: string;
  readonly tag?: string;
  readonly expectedSha?: string;
  readonly dryRun?: boolean;
}

const requireDirectory = (directory: string, label: string): void => {
  try {
    if (lstatSync(directory).isDirectory()) {
      return;
    }
  } catch {
    // Fall through to the consistent error below.
  }
  throw new Error(`${label} must be a regular directory`);
};

const readMetadataFile = (
  metadataDirectory: string,
  filename: "sha" | "tag",
): string => {
  const file = join(metadataDirectory, filename);
  try {
    if (!lstatSync(file).isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new Error(`Release metadata ${filename} must be a regular file`);
  }
  return readFileSync(file, "utf8").trim();
};

const parseRegistryErrorCode = (stdout: string, stderr: string): unknown => {
  for (const source of [stdout, stderr]) {
    if (source.trim().length === 0) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(source);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        "error" in parsed
      ) {
        const error = parsed.error;
        if (
          typeof error === "object" &&
          error !== null &&
          !Array.isArray(error) &&
          "code" in error
        ) {
          return error.code;
        }
      }
    } catch {
      const errorCode = source.match(/\bE\d{3}\b/u)?.[0];
      if (errorCode !== undefined) {
        return errorCode;
      }
      // An unstructured failure is not proof that a package is absent.
    }
  }
  return undefined;
};

export const publishReleasePackages = ({
  root,
  registry,
  tag,
  expectedSha,
  dryRun = false,
}: PublishReleasePackagesOptions): void => {
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

  if (tag !== undefined && expectedSha !== undefined) {
    throw new Error("Use --tag locally or --expected-sha in CI, not both");
  }

  let releaseTag = tag;
  if (expectedSha !== undefined) {
    const metadataDirectory = join(root, "release-metadata");
    requireDirectory(metadataDirectory, "release-metadata");
    const sha = readMetadataFile(metadataDirectory, "sha");
    if (!/^[a-f0-9]{40}$/u.test(sha) || sha !== expectedSha) {
      throw new Error(
        "Release metadata SHA does not match the expected build SHA",
      );
    }
    releaseTag = readMetadataFile(metadataDirectory, "tag");
  }

  if (releaseTag === undefined) {
    throw new Error("Supply --tag or --expected-sha");
  }
  const version = versionFromReleaseTag(releaseTag);
  const { distTag } = parseReleaseVersion(version);

  const directory = join(root, "release-packages");
  requireDirectory(directory, "release-packages");
  const artifacts = readdirSync(directory)
    .filter((file) => file.endsWith(".tgz"))
    .map((name) => {
      const file = join(directory, name);
      if (!lstatSync(file).isFile()) {
        throw new Error(`Not a regular tarball: ${file}`);
      }
      return {
        file,
        manifest: readPackageManifestFromTarball(file),
      };
    });
  const plan = planRelease(artifacts, version);

  if (dryRun) {
    for (const { manifest } of plan) {
      console.log(
        `${warning("WOULD PUBLISH")} ` +
          `${accent(`${String(manifest.name)}@${version}`)} --tag ${accent(distTag)}`,
      );
    }
    return;
  }

  const npmCli = resolveNpmCli();
  const npmArgs = (args: readonly string[]): string[] => [npmCli, ...args];
  const isAlreadyPublished = (name: string, file: string): boolean => {
    const result = spawnSync(
      process.execPath,
      npmArgs([
        "view",
        `${name}@${version}`,
        "dist.integrity",
        "--json",
        "--registry",
        registry,
      ]),
      { encoding: "utf8" },
    );

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const errorCode = parseRegistryErrorCode(
        result.stdout ?? "",
        result.stderr ?? "",
      );
      if (result.status !== null && errorCode === "E404") {
        return false;
      }
      const details = [result.stderr, result.stdout]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
        .map((value) => value.trim())
        .join("\n");
      throw new Error(
        `Registry lookup failed for ${name}@${version}` +
          (details.length > 0
            ? `: ${details}`
            : ` (npm exited with status ${result.status ?? "unknown"})`),
      );
    }

    const integrity: unknown = JSON.parse(result.stdout);
    const expected = `sha512-${createHash("sha512")
      .update(readFileSync(file))
      .digest("base64")}`;
    if (
      typeof integrity !== "string" ||
      !integrity.split(/\s+/u).includes(expected)
    ) {
      throw new Error(
        `Published tarball differs from local artifact: ${name}@${version}`,
      );
    }
    return true;
  };

  // Preflight every package before the first registry mutation.
  const pending = plan.filter(({ manifest, file }) => {
    const name = String(manifest.name);
    if (!isAlreadyPublished(name, file)) {
      return true;
    }
    console.log(
      `${success("SKIP")} Identical ${accent(`${name}@${version}`)} already published`,
    );
    return false;
  });

  for (const { file } of pending) {
    run(
      process.execPath,
      npmArgs([
        "publish",
        file,
        "--registry",
        registry,
        "--access",
        "public",
        "--ignore-scripts",
        "--tag",
        distTag,
      ]),
    );
  }

  console.log(
    `${success("DONE")} Release ${accent(version)} complete (${accent(distTag)}); ` +
      `${accent(String(pending.length))} packages ` +
      "published",
  );
};
