import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { accent, success } from "../lib/output.ts";
import { collectPublicExports } from "./public-export-shape.ts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const PUBLISHABLE_PACKAGES: readonly string[] = [
  "packages/auth",
  "packages/core",
  "packages/codegen",
  "packages/jsforce",
  "packages/rest",
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

const sortedSet = (values: ReadonlySet<string>): readonly string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const assertExportSetEqual = (
  packageName: string,
  surface: string,
  expected: ReadonlySet<string>,
  actual: ReadonlySet<string>,
): void => {
  const missing = sortedSet(
    new Set([...expected].filter((name) => !actual.has(name))),
  );
  const unexpected = sortedSet(
    new Set([...actual].filter((name) => !expected.has(name))),
  );

  if (missing.length === 0 && unexpected.length === 0) {
    return;
  }

  const details = [
    missing.length > 0 ? `missing ${missing.join(", ")}` : undefined,
    unexpected.length > 0
      ? `unexpected ${unexpected.join(", ")}`
      : undefined,
  ].filter((detail): detail is string => detail !== undefined);

  fail(`${packageName} ${surface} exports differ from src/index.ts: ${details.join("; ")}.`);
};

const verifyPublicExportParity = async (
  packageName: string,
  packageDir: string,
  runtimeTarget: string,
): Promise<void> => {
  const sourceIndex = resolve(packageDir, "src/index.ts");
  const declarationTarget = declarationTargetFor(runtimeTarget);

  if (declarationTarget === undefined) {
    return fail(`${packageName} root runtime target is unsupported: ${runtimeTarget}.`);
  }

  const [sourceText, declarationText] = await Promise.all([
    readFile(sourceIndex, "utf8"),
    readFile(resolvePackageTarget(packageDir, declarationTarget), "utf8"),
  ]);
  const sourceExports = collectPublicExports(
    sourceText,
    `${packageName} src/index.ts`,
  );
  const declarationExports = collectPublicExports(
    declarationText,
    `${packageName} ${declarationTarget}`,
  );

  assertExportSetEqual(
    packageName,
    "declaration",
    sourceExports.all,
    declarationExports.all,
  );

  const runtimeModule: Readonly<Record<string, unknown>> = await import(
    pathToFileURL(resolvePackageTarget(packageDir, runtimeTarget)).href
  );
  const runtimeExports = new Set(Object.keys(runtimeModule));

  assertExportSetEqual(
    packageName,
    "runtime",
    sourceExports.runtime,
    runtimeExports,
  );
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

    const source = await readFile(resolvePackageTarget(packageDir, entry), "utf8");
    if (!source.startsWith("#!/usr/bin/env node\n")) {
      fail(`${packageName}.bin target ${entry} must start with a Node shebang.`);
    }
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
  for (const requiredFile of ["dist", "LICENSE", "README.md"] as const) {
    if (!files.includes(requiredFile)) {
      fail(`${packageName}.files must include ${requiredFile}.`);
    }
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

  const rootExport = publishExports["."];
  if (rootExport === undefined) {
    fail(`${packageName}.publishConfig.exports must define the root export '.'.`);
  }

  const rootRuntimeTargets = collectExportTargets(
    rootExport,
    `${packageName}:.`,
  ).filter(({ target }) => declarationTargetFor(target) !== undefined);

  if (rootRuntimeTargets.length === 0) {
    fail(`${packageName} root export must include a JavaScript runtime target.`);
  }

  for (const { target } of rootRuntimeTargets) {
    await verifyPublicExportParity(packageName, packageDir, target);
  }

  await verifyBinTargets(packageName, packageDir, manifest.bin);

  console.log(`${success("VERIFIED")} ${accent(packageName)}`);
};

for (const workspacePath of PUBLISHABLE_PACKAGES) {
  await verifyPackage(workspacePath);
}
