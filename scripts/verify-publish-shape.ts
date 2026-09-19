import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const PUBLISHABLE_PACKAGES: readonly string[] = [
  "packages/core",
  "packages/codegen",
  "packages/jsforce",
];

type JsonObject = Readonly<Record<string, unknown>>;

interface ExportTarget {
  readonly condition: string;
  readonly target: string;
}

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fail = (message: string): never => {
  throw new Error(`Publish-shape verification failed: ${message}`);
};

const readManifest = async (packageDir: string): Promise<JsonObject> => {
  const manifestPath = resolve(packageDir, "package.json");
  const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!isJsonObject(parsed)) {
    return fail(`${manifestPath} must contain a JSON object.`);
  }

  return parsed;
};

const requireString = (
  object: JsonObject,
  key: string,
  context: string,
): string => {
  const value = object[key];

  if (typeof value !== "string" || value.length === 0) {
    return fail(`${context}.${key} must be a non-empty string.`);
  }

  return value;
};

const requireObject = (
  object: JsonObject,
  key: string,
  context: string,
): JsonObject => {
  const value = object[key];

  if (!isJsonObject(value)) {
    return fail(`${context}.${key} must be an object.`);
  }

  return value;
};

const isNonEmptyStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.every(
    (entry: unknown) => typeof entry === "string" && entry.length > 0,
  );

const requireStringArray = (
  object: JsonObject,
  key: string,
  context: string,
): readonly string[] => {
  const value = object[key];

  if (!isNonEmptyStringArray(value)) {
    return fail(`${context}.${key} must be an array of non-empty strings.`);
  }

  return value;
};

const collectExportTargets = (
  value: unknown,
  condition: string,
): readonly ExportTarget[] => {
  if (typeof value === "string") {
    return [{ condition, target: value }];
  }

  if (!isJsonObject(value)) {
    return fail(`${condition} must resolve to a string or conditional object.`);
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    if (key === "development") {
      return fail(`${condition} must not publish a development condition.`);
    }

    return collectExportTargets(nestedValue, `${condition}.${key}`);
  });
};

const resolvePackageTarget = (packageDir: string, target: string): string => {
  if (!target.startsWith("./")) {
    return fail(`${target} must be package-relative.`);
  }

  const resolvedTarget = resolve(packageDir, target);
  const relativeTarget = relative(packageDir, resolvedTarget);

  if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    return fail(`${target} escapes its package directory.`);
  }

  return resolvedTarget;
};

const assertExists = async (
  packageName: string,
  packageDir: string,
  target: string,
): Promise<void> => {
  const resolvedTarget = resolvePackageTarget(packageDir, target);

  try {
    await access(resolvedTarget, constants.F_OK);
  } catch {
    fail(`${packageName} declares missing publish target ${target}.`);
  }
};

const declarationTargetFor = (runtimeTarget: string): string | undefined => {
  if (runtimeTarget.endsWith(".mjs")) {
    return `${runtimeTarget.slice(0, -4)}.d.mts`;
  }

  if (runtimeTarget.endsWith(".cjs")) {
    return `${runtimeTarget.slice(0, -4)}.d.cts`;
  }

  if (runtimeTarget.endsWith(".js")) {
    return `${runtimeTarget.slice(0, -3)}.d.ts`;
  }

  return undefined;
};

const verifyBinTargets = async (
  packageName: string,
  packageDir: string,
  bin: unknown,
): Promise<void> => {
  if (bin === undefined) {
    return;
  }

  const targets =
    typeof bin === "string"
      ? [bin]
      : isJsonObject(bin)
        ? Object.values(bin)
        : fail(`${packageName}.bin must be a string or object.`);

  for (const entry of targets) {
    if (typeof entry !== "string") {
      return fail(`${packageName}.bin entries must be strings.`);
    }

    if (!entry.startsWith("./dist/")) {
      return fail(
        `${packageName}.bin target ${entry} must point into ./dist/.`,
      );
    }

    await assertExists(packageName, packageDir, entry);
  }
};

const verifyPackage = async (workspacePath: string): Promise<void> => {
  const packageDir = resolve(ROOT_DIR, workspacePath);
  const manifest = await readManifest(packageDir);
  const packageName = requireString(manifest, "name", workspacePath);

  if (manifest.private === true) {
    fail(`${packageName} is listed as publishable but marked private.`);
  }

  const files = requireStringArray(manifest, "files", packageName);
  if (!files.includes("dist")) {
    fail(`${packageName}.files must include dist.`);
  }

  const publishConfig = requireObject(manifest, "publishConfig", packageName);
  const publishExports = requireObject(
    publishConfig,
    "exports",
    `${packageName}.publishConfig`,
  );
  const exportTargets = Object.entries(publishExports).flatMap(
    ([subpath, value]) =>
      collectExportTargets(value, `${packageName}:${subpath}`),
  );

  if (exportTargets.length === 0) {
    fail(`${packageName} must publish at least one export.`);
  }

  for (const { condition, target } of exportTargets) {
    if (target !== "./package.json" && !target.startsWith("./dist/")) {
      fail(`${condition} points outside ./dist/: ${target}.`);
    }

    await assertExists(packageName, packageDir, target);

    const declarationTarget = declarationTargetFor(target);
    if (declarationTarget !== undefined) {
      await assertExists(packageName, packageDir, declarationTarget);
    }
  }

  await verifyBinTargets(packageName, packageDir, manifest.bin);

  console.log(`verified ${packageName}`);
};

for (const workspacePath of PUBLISHABLE_PACKAGES) {
  await verifyPackage(workspacePath);
}
