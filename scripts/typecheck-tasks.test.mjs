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
  [docs, ["@kysoql/core", "@kysoql/jsforce", "@kysoql/codegen"]],
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
