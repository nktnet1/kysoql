import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8"));

const [turbo, debug, docs] = await Promise.all([
  readJson("turbo.json"),
  readJson("packages/debug/package.json"),
  readJson("apps/docs/package.json"),
]);

// This script used to run `pnpm --filter @kysoql/core build` before tsc.
// Turbo had already built/restored core, so that second build could clean dist
// while the docs or another consumer was reading its declarations. Keep this
// task read-only; its prerequisites belong in Turbo's dependency graph.
test("debug source typechecking does not rebuild or clean dependencies", () => {
  assert.equal(
    debug.scripts["typecheck:source"],
    "tsc -p tsconfig.json --noEmit",
    "Do not rebuild core inside the debug typecheck; Turbo's ^build handles it.",
  );
});

for (const [consumer, dependencies] of [
  [debug, ["@kysoql/core"]],
  [docs, ["@kysoql/core", "@kysoql/rest", "@kysoql/jsforce", "@kysoql/codegen"]],
]) {
  for (const name of dependencies) {
    test(`${consumer.name} declares ${name} so Turbo can order its build`, () => {
      const version =
        consumer.dependencies?.[name] ?? consumer.devDependencies?.[name];
      assert.equal(
        version,
        "workspace:*",
        `${consumer.name} must declare ${name}; an import alone does not create a Turbo dependency.`,
      );
    });
  }
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

const manifests = new Map();
for (const name of ["core", "rest", "codegen", "jsforce"]) {
  manifests.set(`@kysoql/${name}`, await readJson(`packages/${name}/package.json`));
}

for (const name of ["@kysoql/core", "@kysoql/rest", "@kysoql/codegen"]) {
  test(`${name}'s runtime workspace dependency graph is JSforce-free`, () => {
    const visited = new Set();
    const visit = (name) => {
      if (visited.has(name)) {
        return;
      }
      visited.add(name);
      assert.ok(name !== "jsforce" && name !== "@kysoql/jsforce", `${name} must remain optional.`);
      const manifest = manifests.get(name);
      for (const dependency of Object.keys({ ...manifest?.dependencies, ...manifest?.optionalDependencies, ...manifest?.peerDependencies })) {
        visit(dependency);
      }
    };
    visit(name);
  });
}

for (const [consumer, dependency] of [["@kysoql/rest", "@kysoql/core"], ["@kysoql/codegen", "@kysoql/rest"]]) {
  test(`${consumer} declares ${dependency} for Turbo build ordering`, () => {
    assert.equal(manifests.get(consumer).dependencies[dependency], "workspace:*");
  });
}


test("schema-generation helper builds codegen dependencies through Turbo", async () => {
  const script = await readFile(new URL("scripts/generate-salesforce-schema.sh", root), "utf8");
  assert.ok(script.includes("pnpm exec turbo run build --filter=@kysoql/codegen"));
  assert.ok(!script.includes("pnpm --filter @kysoql/codegen build"));
});

// TypeScript 6+ no longer includes visible @types packages automatically.
// REST uses Node's fetch/URL/abort globals without importing a node: module, so
// its source build must explicitly opt in instead of relying on test imports.
test("REST source explicitly loads Node runtime types", async () => {
  const config = await readJson("packages/rest/tsconfig.json");
  assert.ok(
    config.compilerOptions.types?.includes("node"),
    "REST requires Node types for fetch, URL, Response, and AbortSignal.",
  );
});

test("REST tests retain the source config's Node runtime types", async () => {
  const config = await readJson("packages/rest/tests/tsconfig.json");
  assert.equal(config.extends, "../tsconfig.json");
  assert.ok(
    config.compilerOptions.types === undefined ||
      config.compilerOptions.types.includes("node"),
    'A test-specific types list replaces inherited types and must retain "node".',
  );
});
