import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

import { parseJson, requireCommand, requireNode26, run } from "./lib/command.ts";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const PUBLISHABLE_PACKAGES = [
  { name: "@kysoql/auth", workspacePath: "packages/auth" },
  { name: "@kysoql/core", workspacePath: "packages/core" },
  { name: "@kysoql/codegen", workspacePath: "packages/codegen" },
  { name: "@kysoql/jsforce", workspacePath: "packages/jsforce" },
  { name: "@kysoql/rest", workspacePath: "packages/rest" },
] as const;

type JsonObject = Readonly<Record<string, unknown>>;

type PackedPackage = (typeof PUBLISHABLE_PACKAGES)[number] & {
  readonly tarballPath: string;
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fail = (message: string): never => {
  throw new Error(`Packed-consumer verification failed: ${message}`);
};

const readJsonObject = async (
  path: string,
  context: string,
): Promise<JsonObject> => {
  const parsed = parseJson<unknown>(await readFile(path, "utf8"), context);
  return isJsonObject(parsed)
    ? parsed
    : fail(`${context} must contain a JSON object.`);
};

const requireString = (
  object: JsonObject,
  key: string,
  context: string,
): string => {
  const value = object[key];
  return typeof value === "string" && value.length > 0
    ? value
    : fail(`${context}.${key} must be a non-empty string.`);
};

const requireObject = (
  object: JsonObject,
  key: string,
  context: string,
): JsonObject => {
  const value = object[key];
  return isJsonObject(value)
    ? value
    : fail(`${context}.${key} must be an object.`);
};

const normaliseDependencyPath = (from: string, to: string): string => {
  const path = relative(from, to).replaceAll("\\", "/");
  return `file:${path.startsWith(".") ? path : `./${path}`}`;
};

const packPackage = async (
  packageInfo: (typeof PUBLISHABLE_PACKAGES)[number],
  tarballDir: string,
): Promise<PackedPackage> => {
  const before = new Set(await readdir(tarballDir));
  const packageDir = resolve(ROOT_DIR, packageInfo.workspacePath);

  run("pnpm", ["pack", "--pack-destination", tarballDir], { cwd: packageDir });

  const created = (await readdir(tarballDir)).filter(
    (entry) => entry.endsWith(".tgz") && !before.has(entry),
  );
  if (created.length !== 1) {
    return fail(
      `${packageInfo.name} pack created ${created.length} tarballs; expected exactly one.`,
    );
  }

  return { ...packageInfo, tarballPath: resolve(tarballDir, created[0] ?? "") };
};

const collectExportTargets = (
  value: unknown,
  context: string,
): readonly string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (!isJsonObject(value)) {
    return fail(`${context} must resolve to a string or conditional object.`);
  }

  return Object.entries(value).flatMap(([condition, nested]) => {
    if (condition === "development") {
      return fail(
        `${context} must not retain the development export condition after packing.`,
      );
    }
    return collectExportTargets(nested, `${context}.${condition}`);
  });
};

const assertNoWorkspaceDependencies = (
  manifest: JsonObject,
  packageName: string,
): void => {
  for (const section of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    const value = manifest[section];
    if (value === undefined) {
      continue;
    }
    const dependencies = isJsonObject(value)
      ? value
      : fail(`${packageName}.${section} must be an object when present.`);

    for (const [dependencyName, specifier] of Object.entries(dependencies)) {
      const dependencySpecifier =
        typeof specifier === "string"
          ? specifier
          : fail(
              `${packageName}.${section}.${dependencyName} must be a string.`,
            );

      if (/^(?:workspace|link|file):/u.test(dependencySpecifier)) {
        fail(
          `${packageName}.${section}.${dependencyName} retained local-only specifier ${dependencySpecifier}.`,
        );
      }
    }
  }
};

const assertPackageShape = async (
  consumerDir: string,
  packedPackage: PackedPackage,
  version: string,
): Promise<void> => {
  const packageDir = resolve(
    consumerDir,
    "node_modules",
    ...packedPackage.name.split("/"),
  );
  const manifest = await readJsonObject(
    resolve(packageDir, "package.json"),
    `${packedPackage.name} packed manifest`,
  );

  if (
    requireString(manifest, "name", packedPackage.name) !== packedPackage.name
  ) {
    fail(`${packedPackage.name} changed package name while packing.`);
  }
  if (requireString(manifest, "version", packedPackage.name) !== version) {
    fail(
      `${packedPackage.name} packed version does not match the workspace version ${version}.`,
    );
  }

  assertNoWorkspaceDependencies(manifest, packedPackage.name);
  const exportsField = requireObject(manifest, "exports", packedPackage.name);
  const rootExport = exportsField["."];
  if (rootExport === undefined) {
    fail(`${packedPackage.name}.exports must define '.'.`);
  }
  const targets = collectExportTargets(
    rootExport,
    `${packedPackage.name}.exports["."]`,
  );
  if (
    targets.length === 0 ||
    targets.some((target) => !target.startsWith("./dist/"))
  ) {
    fail(`${packedPackage.name} root export must resolve only into ./dist/.`);
  }

  await Promise.all([
    access(resolve(packageDir, "dist/index.mjs")),
    access(resolve(packageDir, "dist/index.d.mts")),
  ]);

  try {
    await access(resolve(packageDir, "src/index.ts"));
    fail(`${packedPackage.name} unexpectedly packed src/index.ts.`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Packed-consumer verification failed:")
    ) {
      throw error;
    }
  }
};

const localTarballMap = (
  consumerDir: string,
  packedPackages: readonly PackedPackage[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    packedPackages.map((packedPackage) => [
      packedPackage.name,
      normaliseDependencyPath(consumerDir, packedPackage.tarballPath),
    ]),
  );

const writeWorkspaceOverrides = async (
  consumerDir: string,
  tarballs: Readonly<Record<string, string>>,
): Promise<void> => {
  const source = [
    "overrides:",
    ...Object.entries(tarballs).map(
      ([name, specifier]) =>
        `  ${JSON.stringify(name)}: ${JSON.stringify(specifier)}`,
    ),
    "",
  ].join("\n");
  await writeFile(resolve(consumerDir, "pnpm-workspace.yaml"), source, "utf8");
};

const verifyIsolatedPackageImports = async (
  tempRoot: string,
  packedPackages: readonly PackedPackage[],
): Promise<void> => {
  const isolationRoot = resolve(tempRoot, "isolated");
  await mkdir(isolationRoot);

  for (const packedPackage of packedPackages) {
    const packageDir = resolve(
      isolationRoot,
      packedPackage.name.replaceAll("/", "-"),
    );
    await mkdir(packageDir);
    const tarballs = localTarballMap(packageDir, packedPackages);

    await writeFile(
      resolve(packageDir, "package.json"),
      `${JSON.stringify(
        {
          name: `kysoql-packed-isolation-${packedPackage.name.slice(8)}`,
          private: true,
          type: "module",
          dependencies: {
            [packedPackage.name]: tarballs[packedPackage.name],
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeWorkspaceOverrides(packageDir, tarballs);

    console.log(`installing isolated ${packedPackage.name} consumer`);
    run(
      "pnpm",
      ["install", "--offline", "--ignore-scripts", "--frozen-lockfile=false"],
      {
        cwd: packageDir,
        env: { ...process.env, NODE_PATH: "" },
      },
    );
    run(
      "node",
      [
        "--input-type=module",
        "--eval",
        `await import(${JSON.stringify(packedPackage.name)});`,
      ],
      {
        cwd: packageDir,
        env: { ...process.env, NODE_PATH: "" },
      },
    );
  }
};

const writeConsumerFixture = async (
  consumerDir: string,
  packedPackages: readonly PackedPackage[],
  typescriptVersion: string,
  nodeTypesVersion: string,
): Promise<void> => {
  const dependencies = localTarballMap(consumerDir, packedPackages);

  await writeFile(
    resolve(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        name: "kysoql-packed-consumer-smoke",
        private: true,
        type: "module",
        dependencies,
        devDependencies: {
          "@types/node": nodeTypesVersion,
          typescript: typescriptVersion,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeWorkspaceOverrides(consumerDir, dependencies);

  await writeFile(
    resolve(consumerDir, "runtime-smoke.mjs"),
    `import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

import { createMemoryRefreshTokenStore } from "@kysoql/auth";
import { renderSchema } from "@kysoql/codegen";
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";
import { createRestClient, DEFAULT_API_VERSION } from "@kysoql/rest";

const query = new Kysoql()
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "=", "Acme");
const compiled = query.compile();
assert.equal(compiled.soql, "SELECT Id, Name FROM Account WHERE Name = 'Acme'");

const store = createMemoryRefreshTokenStore("refresh-token");
assert.equal(await store.getRefreshToken(), "refresh-token");

const restClient = createRestClient({
  instanceUrl: "https://example.my.salesforce.com",
  accessToken: "access-token",
  fetch: async () => {
    throw new Error("packed-consumer smoke test must not make network requests");
  },
});
assert.equal(restClient.apiVersion, DEFAULT_API_VERSION);

const executor = createJsforceExecutor({
  query: async (soql) => {
    assert.equal(soql, compiled.soql);
    return { done: true, records: [{ Id: "001", Name: "Acme" }] };
  },
  queryMore: async () => {
    throw new Error("queryMore should not be called for a completed result");
  },
});
const rows = await executor.executeQuery(compiled);
assert.deepEqual(rows, [{ Id: "001", Name: "Acme" }]);

const generated = renderSchema([
  {
    name: "Account",
    fields: [
      {
        name: "Id",
        type: "id",
        nillable: false,
        filterable: true,
        sortable: true,
        groupable: true,
        aggregatable: false,
        custom: false,
      },
      {
        name: "Name",
        type: "string",
        nillable: true,
        filterable: true,
        sortable: true,
        groupable: true,
        aggregatable: false,
        custom: false,
      },
    ],
  },
]);
assert.match(generated, /from "@kysoql\\/core";/u);
await writeFile(new URL("./salesforce.generated.ts", import.meta.url), generated, "utf8");
`,
    "utf8",
  );

  await writeFile(
    resolve(consumerDir, "typecheck.ts"),
    `import { createMemoryRefreshTokenStore, type RefreshTokenStore } from "@kysoql/auth";
import { renderSchema, type SalesforceObjectDescription } from "@kysoql/codegen";
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor, type JsforceConnection } from "@kysoql/jsforce";
import { createRestClient, type RestClient } from "@kysoql/rest";
import type { SalesforceSchema } from "./salesforce.generated.js";

const db = new Kysoql<SalesforceSchema>();
const compiled = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "=", "Acme")
  .compile();
const renderedSoql: string = compiled.soql;

const store: RefreshTokenStore = createMemoryRefreshTokenStore("refresh-token");
const restClient: RestClient = createRestClient({
  instanceUrl: "https://example.my.salesforce.com",
  accessToken: "access-token",
});
const connection: JsforceConnection = {
  query: async () => ({ done: true, records: [] }),
  queryMore: async () => ({ done: true, records: [] }),
};
const executor = createJsforceExecutor(connection);
const description: SalesforceObjectDescription = {
  name: "Account",
  fields: [],
};
const generated: string = renderSchema([description]);

void renderedSoql;
void store;
void restClient;
void executor;
void generated;
`,
    "utf8",
  );

  await writeFile(
    resolve(consumerDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2024",
          lib: ["ES2024", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: ["node"],
        },
        include: ["typecheck.ts", "salesforce.generated.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const main = async (): Promise<void> => {
  requireNode26();
  requireCommand("pnpm");

  const rootManifest = await readJsonObject(
    resolve(ROOT_DIR, "package.json"),
    "root package.json",
  );
  const version = requireString(rootManifest, "version", "root package.json");
  const devDependencies = requireObject(
    rootManifest,
    "devDependencies",
    "root package.json",
  );
  const typescriptVersion = requireString(
    devDependencies,
    "typescript",
    "root devDependencies",
  );
  const nodeTypesVersion = requireString(
    devDependencies,
    "@types/node",
    "root devDependencies",
  );

  const tempRoot = await mkdtemp(resolve(tmpdir(), "kysoql-packed-consumer-"));
  const tarballDir = resolve(tempRoot, "tarballs");
  const consumerDir = resolve(tempRoot, "consumer");
  await Promise.all([mkdir(tarballDir), mkdir(consumerDir)]);

  let succeeded = false;
  try {
    const packedPackages: PackedPackage[] = [];
    for (const packageInfo of PUBLISHABLE_PACKAGES) {
      console.log(`packing ${packageInfo.name}`);
      packedPackages.push(await packPackage(packageInfo, tarballDir));
    }

    await verifyIsolatedPackageImports(tempRoot, packedPackages);

    await writeConsumerFixture(
      consumerDir,
      packedPackages,
      typescriptVersion,
      nodeTypesVersion,
    );

    console.log("installing packed packages into isolated offline consumer");
    run(
      "pnpm",
      ["install", "--offline", "--ignore-scripts", "--frozen-lockfile=false"],
      {
        cwd: consumerDir,
        env: { ...process.env, NODE_PATH: "" },
      },
    );

    for (const packedPackage of packedPackages) {
      await assertPackageShape(consumerDir, packedPackage, version);
    }

    console.log("running packed ESM/runtime smoke test");
    run("node", ["runtime-smoke.mjs"], {
      cwd: consumerDir,
      env: { ...process.env, NODE_PATH: "" },
    });

    console.log("typechecking generated schema and public declarations");
    run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], {
      cwd: consumerDir,
      env: { ...process.env, NODE_PATH: "" },
    });

    console.log("running installed CLI binary");
    const cliHelp = run("pnpm", ["exec", "kysoql", "--help"], {
      cwd: consumerDir,
      capture: true,
      env: { ...process.env, NODE_PATH: "" },
    });
    if (!cliHelp.includes("generate")) {
      fail(
        "installed kysoql --help output does not expose the generate command.",
      );
    }

    succeeded = true;
    console.log("packed-consumer verification passed");
  } finally {
    if (succeeded) {
      await rm(tempRoot, { recursive: true, force: true });
    } else {
      console.error(
        `packed-consumer fixture retained for debugging: ${tempRoot}`,
      );
    }
  }
};

await main();
