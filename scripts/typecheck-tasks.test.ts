import { readdir, readFile } from "node:fs/promises";
import * as ts from "typescript";
import * as v from "valibot";
import { expect, it } from "vitest";

const root = new URL("../", import.meta.url);

const stringRecordSchema = v.record(v.string(), v.string());
const packageManifestSchema = v.looseObject({
  name: v.optional(v.string()),
  dependencies: v.optional(stringRecordSchema),
  devDependencies: v.optional(stringRecordSchema),
  optionalDependencies: v.optional(stringRecordSchema),
  peerDependencies: v.optional(stringRecordSchema),
});
const turboSchema = v.object({
  tasks: v.record(
    v.string(),
    v.looseObject({
      dependsOn: v.optional(v.array(v.string()), []),
      outputs: v.optional(v.array(v.string()), []),
    }),
  ),
});
const tsconfigSchema = v.looseObject({
  extends: v.optional(v.string()),
  compilerOptions: v.optional(
    v.looseObject({
      types: v.optional(v.array(v.string())),
    }),
    {},
  ),
});

const readJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(relativePath, root), "utf8")) as unknown;

const readPackageManifest = async (relativePath: string) =>
  v.parse(packageManifestSchema, await readJson(relativePath));

const ignoredWalkDirectories = new Set([".generated", "dist", "node_modules"]);

async function walkFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      if (entry.isDirectory() && ignoredWalkDirectories.has(entry.name)) {
        return [];
      }
      const url = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        directory,
      );
      return entry.isDirectory() ? walkFiles(url) : [url];
    }),
  );
  return files.flat();
}

const [turbo, docs] = await Promise.all([
  readJson("turbo.json").then((input) => v.parse(turboSchema, input)),
  readPackageManifest("apps/docs/package.json"),
]);

const getTurboTask = (name: string) => {
  const task = turbo.tasks[name];
  if (task === undefined) {
    throw new Error(`Missing Turbo task: ${name}`);
  }
  return task;
};

it("repository-authored script entrypoints use TypeScript", async () => {
  const roots = [
    new URL("scripts/", root),
    new URL("apps/docs/scripts/", root),
    new URL("test/salesforce-e2e/", root),
  ];
  const files = (await Promise.all(roots.map(walkFiles))).flat();
  const legacy = files
    .map((file) => file.pathname)
    .filter((file) => /\.(?:mjs|cjs|sh)$/u.test(file));
  expect(legacy).toEqual([]);
});

it("authored TypeScript avoids explicit any", async () => {
  const roots = [
    new URL("packages/", root),
    new URL("scripts/", root),
    new URL("test/salesforce-e2e/", root),
    new URL("apps/docs/scripts/", root),
    new URL("apps/docs/src/", root),
  ];
  const files = (await Promise.all(roots.map(walkFiles)))
    .flat()
    .filter(
      (file) =>
        /\.(?:[cm]?ts|tsx)$/u.test(file.pathname) &&
        !file.pathname.includes("/dist/") &&
        !file.pathname.includes("/.generated/") &&
        !file.pathname.endsWith(".generated.ts") &&
        !file.pathname.endsWith("/staticMiddlewareFunction.ts") &&
        !file.pathname.endsWith("/routeTree.gen.ts"),
    );
  const offenders: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file.pathname,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.pathname.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    let hasExplicitAny = false;
    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        hasExplicitAny = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (hasExplicitAny) {
      offenders.push(file.pathname);
    }
  }

  expect(offenders).toEqual([]);
});

for (const name of [
  "@kysoql/core",
  "@kysoql/rest",
  "@kysoql/auth",
  "@kysoql/jsforce",
  "@kysoql/codegen",
]) {
  it(`${docs.name} declares ${name} so Turbo can order its build`, () => {
    const version = docs.dependencies?.[name] ?? docs.devDependencies?.[name];
    expect(version).toBe("workspace:*");
  });
}

for (const task of ["typecheck", "typecheck:source", "typecheck:test"]) {
  it(`${task} waits for dependency builds`, () => {
    expect(getTurboTask(task).dependsOn).toContain("^build");
  });
}

it("cached builds restore the declarations consumed by typechecks", () => {
  expect(getTurboTask("build").outputs).toContain("dist/**");
});

const manifests = new Map<
  string,
  v.InferOutput<typeof packageManifestSchema>
>();
for (const name of ["core", "rest", "auth", "codegen", "jsforce"]) {
  manifests.set(
    `@kysoql/${name}`,
    await readPackageManifest(`packages/${name}/package.json`),
  );
}

for (const name of [
  "@kysoql/core",
  "@kysoql/rest",
  "@kysoql/auth",
  "@kysoql/codegen",
]) {
  it(`${name}'s runtime workspace dependency graph is JSforce-free`, () => {
    const visited = new Set<string>();
    const visit = (dependencyName: string): void => {
      if (visited.has(dependencyName)) {
        return;
      }
      visited.add(dependencyName);
      expect(dependencyName).not.toBe("jsforce");
      expect(dependencyName).not.toBe("@kysoql/jsforce");
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
  it(`${consumer} declares ${dependency} for Turbo build ordering`, () => {
    expect(manifests.get(consumer)?.dependencies?.[dependency]).toBe(
      "workspace:*",
    );
  });
}

it("Salesforce generated-query E2E uses the generated schema type", async () => {
  const source = await readFile(
    new URL("test/salesforce-e2e/generated-query.test.ts", root),
    "utf8",
  );
  expect(source).toContain(
    'import type { SalesforceSchema } from "../salesforce/salesforce.generated.ts";',
  );
  expect(source).toContain("new Kysoql<SalesforceSchema>()");
});

it("schema-generation helper builds codegen dependencies through Turbo", async () => {
  const script = await readFile(
    new URL("scripts/generate-salesforce-schema.ts", root),
    "utf8",
  );
  expect(script).toMatch(
    /\[\s*"exec",\s*"turbo",\s*"run",\s*"build",\s*"--filter=@kysoql\/codegen"\s*\]/u,
  );
  expect(script).not.toMatch(
    /"--filter"\s*,\s*"@kysoql\/codegen"\s*,\s*"build"/u,
  );
});

it("repository Salesforce command scripts use oclif and validated environments", async () => {
  const commands = new Map([
    [
      "scripts/generate-salesforce-schema.ts",
      "readSchemaGenerationEnvironment",
    ],
    ["scripts/setup-salesforce-test-org.ts", "readSalesforceSetupEnvironment"],
    [
      "scripts/run-salesforce-apex-bind-smoke.ts",
      "readSalesforceTargetEnvironment",
    ],
    [
      "scripts/run-salesforce-aggregate-offset-smoke.ts",
      "readSalesforceTargetEnvironment",
    ],
    [
      "scripts/run-salesforce-generated-e2e.ts",
      "readSalesforceTargetEnvironment",
    ],
  ]);

  for (const [relativePath, environmentReader] of commands) {
    const source = await readFile(new URL(relativePath, root), "utf8");
    expect(source).toContain('from "@oclif/core"');
    expect(source).toContain(environmentReader);
    expect(source).not.toContain("function parseArgs(");
    expect(source).not.toContain("function usage(");
  }
});

for (const [label, sourceConfig, testConfig] of [
  ["REST", "packages/rest/tsconfig.json", "packages/rest/tests/tsconfig.json"],
  ["Auth", "packages/auth/tsconfig.json", "packages/auth/tests/tsconfig.json"],
] as const) {
  it(`${label} source explicitly loads Node runtime types`, async () => {
    const config = v.parse(tsconfigSchema, await readJson(sourceConfig));
    expect(config.compilerOptions.types).toContain("node");
  });

  it(`${label} tests retain the source config's Node runtime types`, async () => {
    const config = v.parse(tsconfigSchema, await readJson(testConfig));
    expect(config.extends).toBe("../tsconfig.json");
    if (config.compilerOptions.types !== undefined) {
      expect(config.compilerOptions.types).toContain("node");
    }
  });
}
