import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const PUBLISHABLE_PACKAGES: readonly string[] = [
  "packages/auth",
  "packages/core",
  "packages/codegen",
  "packages/jsforce",
  "packages/rest",
];
const REQUIRED_KEYWORDS: readonly string[] = [
  "salesforce",
  "soql",
  "typescript",
];
const REPOSITORY_TYPE = "git";
const REPOSITORY_URL = "git+https://github.com/nktnet1/kysoql.git";
const BUGS_URL = "https://github.com/nktnet1/kysoql/issues";
const HOMEPAGE_URL = "https://github.com/nktnet1/kysoql#readme";
type JsonObject = Readonly<Record<string, unknown>>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fail = (message: string): never => {
  throw new Error(`Release-metadata verification failed: ${message}`);
};

const readText = async (path: string, context: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return fail(`${context} is missing: ${path}`);
  }
};

const readManifest = async (path: string): Promise<JsonObject> => {
  const source = await readText(path, "package manifest");
  const parsed: unknown = JSON.parse(source);

  if (!isJsonObject(parsed)) {
    return fail(`${path} must contain a JSON object.`);
  }

  return parsed;
};

const requireString = (
  object: JsonObject,
  key: string,
  context: string,
): string => {
  const value = object[key];

  if (typeof value !== "string" || value.trim().length === 0) {
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

const requireStringArray = (
  object: JsonObject,
  key: string,
  context: string,
): readonly string[] => {
  const value = object[key];

  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(
      (entry: unknown) => typeof entry === "string" && entry.trim().length > 0,
    )
  ) {
    return fail(`${context}.${key} must be a non-empty string array.`);
  }

  return value;
};

const verifyProjectLinks = (
  manifest: JsonObject,
  context: string,
  workspacePath?: string,
): void => {
  const repository = requireObject(manifest, "repository", context);
  const repositoryType = requireString(
    repository,
    "type",
    `${context}.repository`,
  );
  const repositoryUrl = requireString(
    repository,
    "url",
    `${context}.repository`,
  );

  if (repositoryType !== REPOSITORY_TYPE || repositoryUrl !== REPOSITORY_URL) {
    fail(
      `${context}.repository must point to ${REPOSITORY_URL} using type ${REPOSITORY_TYPE}.`,
    );
  }

  if (workspacePath !== undefined) {
    const directory = requireString(
      repository,
      "directory",
      `${context}.repository`,
    );
    if (directory !== workspacePath) {
      fail(
        `${context}.repository.directory must be ${workspacePath}; found ${directory}.`,
      );
    }
  }

  const bugs = requireObject(manifest, "bugs", context);
  if (requireString(bugs, "url", `${context}.bugs`) !== BUGS_URL) {
    fail(`${context}.bugs.url must be ${BUGS_URL}.`);
  }

  if (requireString(manifest, "homepage", context) !== HOMEPAGE_URL) {
    fail(`${context}.homepage must be ${HOMEPAGE_URL}.`);
  }
};

const verifyPackage = async (
  workspacePath: string,
  rootVersion: string,
  rootNodeRange: string,
  publishReady: boolean,
): Promise<void> => {
  const packageDir = resolve(ROOT_DIR, workspacePath);
  const manifest = await readManifest(resolve(packageDir, "package.json"));
  const expectedName = `@kysoql/${basename(workspacePath)}`;
  const packageName = requireString(manifest, "name", workspacePath);

  if (packageName !== expectedName) {
    fail(
      `${workspacePath}.name must be ${expectedName}; found ${packageName}.`,
    );
  }

  const version = requireString(manifest, "version", packageName);
  if (version !== rootVersion) {
    fail(
      `${packageName}.version must match workspace version ${rootVersion}; ` +
        `found ${version}.`,
    );
  }

  requireString(manifest, "description", packageName);
  verifyProjectLinks(manifest, packageName, workspacePath);

  if (publishReady) {
    requireString(manifest, "license", packageName);
  }

  if (manifest.sideEffects !== false) {
    fail(`${packageName}.sideEffects must be false.`);
  }

  const engines = requireObject(manifest, "engines", packageName);
  const nodeRange = requireString(engines, "node", `${packageName}.engines`);
  if (nodeRange !== rootNodeRange) {
    fail(
      `${packageName}.engines.node must match the workspace range ` +
        `${rootNodeRange}; found ${nodeRange}.`,
    );
  }

  const keywords = requireStringArray(manifest, "keywords", packageName);
  const uniqueKeywords = new Set(keywords);
  if (uniqueKeywords.size !== keywords.length) {
    fail(`${packageName}.keywords must not contain duplicates.`);
  }

  for (const keyword of REQUIRED_KEYWORDS) {
    if (!uniqueKeywords.has(keyword)) {
      fail(`${packageName}.keywords must include ${keyword}.`);
    }
  }

  const publishConfig = requireObject(manifest, "publishConfig", packageName);
  const access = requireString(
    publishConfig,
    "access",
    `${packageName}.publishConfig`,
  );
  if (access !== "public") {
    fail(`${packageName}.publishConfig.access must be public.`);
  }

  const readme = await readText(
    resolve(packageDir, "README.md"),
    `${packageName} README`,
  );
  if (!readme.startsWith(`# ${packageName}\n`)) {
    fail(`${packageName}/README.md must start with "# ${packageName}".`);
  }
  if (/\]\(\.\.\//u.test(readme)) {
    fail(
      `${packageName}/README.md must not contain repository-relative parent links that break on npm.`,
    );
  }

  console.log(`verified release metadata for ${packageName}`);
};

const rootManifest = await readManifest(resolve(ROOT_DIR, "package.json"));
const rootVersion = requireString(rootManifest, "version", "workspace");
const publishReady = process.argv.includes("--publish-ready");

if (publishReady && rootVersion === "0.0.0") {
  fail(
    'workspace.version must be changed from the development placeholder "0.0.0" before publishing.',
  );
}

if (rootManifest.private !== true) {
  fail("workspace root must remain private.");
}
verifyProjectLinks(rootManifest, "workspace");

const rootEngines = requireObject(rootManifest, "engines", "workspace");
const rootNodeRange = requireString(rootEngines, "node", "workspace.engines");

for (const workspacePath of PUBLISHABLE_PACKAGES) {
  await verifyPackage(
    workspacePath,
    rootVersion,
    rootNodeRange,
    publishReady,
  );
}
