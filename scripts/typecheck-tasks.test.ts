import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
type JsonRecord = Record<string, any>;
const readJson = async (relativePath: string): Promise<JsonRecord> =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8")) as JsonRecord;

async function walkFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      return entry.isDirectory() ? walkFiles(url) : [url];
    }),
  );
  return files.flat();
}

const [turbo, docs] = await Promise.all([
  readJson("turbo.json"),
  readJson("apps/docs/package.json"),
]);

test("repository-authored script entrypoints use TypeScript", async () => {
  const roots = [
    new URL("scripts/", root),
    new URL("apps/docs/scripts/", root),
    new URL("test/salesforce-e2e/", root),
  ];
  const files = (await Promise.all(roots.map(walkFiles))).flat();
  const legacy = files
    .map((file) => file.pathname)
    .filter((file) => /\.(?:mjs|cjs|sh)$/.test(file));
  assert.deepEqual(legacy, []);
});

for (const name of [
  "@kysoql/core",
  "@kysoql/rest",
  "@kysoql/auth",
  "@kysoql/jsforce",
  "@kysoql/codegen",
]) {
  test(`${docs.name} declares ${name} so Turbo can order its build`, () => {
    const version = docs.dependencies?.[name] ?? docs.devDependencies?.[name];
    assert.equal(
      version,
      "workspace:*",
      `${docs.name} must declare ${name}; an import alone does not create a Turbo dependency.`,
    );
  });
}

for (const task of ["typecheck", "typecheck:source", "typecheck:test"]) {
  test(`${task} waits for dependency builds`, () => {
    assert.ok(
      turbo.tasks[task].dependsOn.includes("^build"),
      `${task} must depend on ^build before consuming package declarations.`,
    );
  });
}

test("cached builds restore the declarations consumed by typechecks", () => {
  assert.ok(
    turbo.tasks.build.outputs.includes("dist/**"),
    "Cache dist/** so a cache hit restores declarations as well as build logs.",
  );
});

const manifests = new Map<string, JsonRecord>();
for (const name of ["core", "rest", "auth", "codegen", "jsforce"]) {
  manifests.set(`@kysoql/${name}`, await readJson(`packages/${name}/package.json`));
}

for (const name of ["@kysoql/core", "@kysoql/rest", "@kysoql/auth", "@kysoql/codegen"]) {
  test(`${name}'s runtime workspace dependency graph is JSforce-free`, () => {
    const visited = new Set<string>();
    const visit = (dependencyName: string): void => {
      if (visited.has(dependencyName)) return;
      visited.add(dependencyName);
      assert.ok(
        dependencyName !== "jsforce" && dependencyName !== "@kysoql/jsforce",
        `${dependencyName} must remain optional.`,
      );
      const manifest = manifests.get(dependencyName);
      for (const dependency of Object.keys({
        ...manifest?.dependencies,
        ...manifest?.optionalDependencies,
        ...manifest?.peerDependencies,
      })) {
        visit(dependency);
      }
    };
    visit(name);
  });
}

for (const [consumer, dependency] of [
  ["@kysoql/rest", "@kysoql/core"],
  ["@kysoql/codegen", "@kysoql/rest"],
] as const) {
  test(`${consumer} declares ${dependency} for Turbo build ordering`, () => {
    assert.equal(manifests.get(consumer)?.dependencies?.[dependency], "workspace:*");
  });
}

test("schema-generation helper builds codegen dependencies through Turbo", async () => {
  const script = await readFile(
    new URL("scripts/generate-salesforce-schema.ts", root),
    "utf8",
  );
  assert.ok(script.includes('["exec", "turbo", "run", "build", "--filter=@kysoql/codegen"]'));
  assert.ok(!script.includes('"--filter", "@kysoql/codegen", "build"'));
});

for (const [label, sourceConfig, testConfig] of [
  ["REST", "packages/rest/tsconfig.json", "packages/rest/tests/tsconfig.json"],
  ["Auth", "packages/auth/tsconfig.json", "packages/auth/tests/tsconfig.json"],
] as const) {
  test(`${label} source explicitly loads Node runtime types`, async () => {
    const config = await readJson(sourceConfig);
    assert.ok(
      config.compilerOptions.types?.includes("node"),
      `${label} requires Node runtime types.`,
    );
  });

  test(`${label} tests retain the source config's Node runtime types`, async () => {
    const config = await readJson(testConfig);
    assert.equal(config.extends, "../tsconfig.json");
    assert.ok(
      config.compilerOptions.types === undefined ||
        config.compilerOptions.types.includes("node"),
      'A test-specific types list replaces inherited types and must retain "node".',
    );
  });
}
