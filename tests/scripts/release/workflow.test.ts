import { readdir, readFile } from "node:fs/promises";

import { expect, it } from "vitest";

import { RELEASE_PACKAGES } from "#scripts/release/policy";

const root = new URL("../../../", import.meta.url);
const readText = (relativePath: string): Promise<string> =>
  readFile(new URL(relativePath, root), "utf8");
const readJson = async (
  relativePath: string,
): Promise<Readonly<Record<string, unknown>>> => {
  const parsed: unknown = JSON.parse(await readText(relativePath));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${relativePath} must contain a JSON object`);
  }
  return parsed as Readonly<Record<string, unknown>>;
};

it("uses .yaml for every GitHub Actions workflow", async () => {
  const workflows = await readdir(new URL(".github/workflows/", root));
  expect(workflows.every((file) => file.endsWith(".yaml"))).toBe(true);
  expect(workflows.sort()).toEqual([
    "ci.yaml",
    "publish.yaml",
    "release-packages.yaml",
  ]);
});

it("builds immutable release artifacts from v-tags", async () => {
  const workflow = await readText(".github/workflows/release-packages.yaml");
  expect(workflow).toContain("name: Release packages");
  expect(workflow).toContain('      - "v*"');
  expect(workflow).toContain("run: pnpm release:check");
  expect(workflow).toContain("scripts/release/pack.ts");
  expect(workflow).toContain("scripts/release/publish.ts");
  expect(workflow).toContain("--dry-run");
  expect(workflow).toContain("scripts/release/write-metadata.ts");
  expect(workflow).not.toContain("run: |");
});

it(
  "publishes only after a successful same-repository release build",
  async () => {
    const workflow = await readText(".github/workflows/publish.yaml");
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("      - Release packages");
    expect(workflow).toContain(
      "github.event.workflow_run.head_repository.full_name == " +
        "github.repository",
    );
    expect(workflow).toContain("ref: ${{ github.workflow_sha }}");
    expect(workflow).toContain(
      "BUILD_SHA: ${{ github.event.workflow_run.head_sha }}",
    );
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("environment: Production");
    expect(workflow).toContain("package-manager-cache: false");
    expect(workflow).toContain("uses: pnpm/action-setup@v6");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("run: |");
  },
);

it("exposes bootstrap and beta release entrypoints", async () => {
  const manifest = await readJson("package.json");
  const scripts = manifest.scripts;
  if (
    typeof scripts !== "object" ||
    scripts === null ||
    Array.isArray(scripts)
  ) {
    throw new Error("root scripts must be an object");
  }
  const commands = scripts as Readonly<Record<string, unknown>>;
  expect(commands["bootstrap:packages"]).toContain(
    "scripts/release/bootstrap.ts",
  );
  expect(commands["release:beta"]).toContain("scripts/release/beta.ts");
  expect(commands["oidc:trust"]).toContain(
    "scripts/release/configure-trusted-publishing.ts",
  );
  expect(commands).not.toHaveProperty("npm:trust");
});

it("uses the official npm trust command for trusted-publisher governance", async () => {
  const source = await readText(
    "scripts/release/configure-trusted-publishing.ts",
  );
  expect(source).toContain('requireCommand("npm")');
  expect(source).toContain('"trust",');
  expect(source).toContain('"github",');
  expect(source).toContain('"--allow-publish",');
  expect(source).toContain('"--environment",');
  expect(source).not.toContain('registryEndpoint("-/v1/login")');
  expect(source).not.toContain("pollWebChallenge");
});

it("uses pnpm exclusively except for trusted-publisher governance", async () => {
  for (const file of [
    "scripts/release/bootstrap.ts",
    "scripts/release/beta.ts",
    "scripts/release/publisher.ts",
  ]) {
    const source = await readText(file);
    expect(source).not.toMatch(/(?:run|requireCommand)\("npm"/u);
    expect(source).not.toMatch(/spawnSync\(\s*"npm"/u);
    expect(source).not.toContain("npm-cli.js");
  }
});

it(
  "keeps every public package in the @kysoql scope and blocks direct publish",
  async () => {
    for (const definition of RELEASE_PACKAGES) {
      const manifest = await readJson(
        `${definition.workspacePath}/package.json`,
      );
      expect(manifest.name).toBe(definition.name);
      const publishConfig = manifest.publishConfig;
      if (
        typeof publishConfig !== "object" ||
        publishConfig === null ||
        Array.isArray(publishConfig)
      ) {
        throw new Error(`${definition.name} publishConfig must be an object`);
      }
      expect((publishConfig as Readonly<Record<string, unknown>>).access).toBe(
        "public",
      );
      const scripts = manifest.scripts;
      if (
        typeof scripts !== "object" ||
        scripts === null ||
        Array.isArray(scripts)
      ) {
        throw new Error(`${definition.name} scripts must be an object`);
      }
      expect(
        (scripts as Readonly<Record<string, unknown>>).prepublishOnly,
      ).toContain("prevent-direct-publish.ts");
    }
  },
);

it("uses node:util styleText for script output tokens", async () => {
  const source = await readText("scripts/lib/output.ts");
  expect(source).toContain('import { styleText } from "node:util";');
  expect(source).toContain('styleText("cyan", value)');
  expect(source).toContain('styleText("green", value)');
  expect(source).toContain('styleText("yellow", value)');
  expect(source).toContain('styleText("red", value)');
});

it("keeps public package metadata searchable and README-ready", async () => {
  const requiredKeywords = [
    "builder",
    "kysely",
    "query",
    "query builder",
    "salesforce",
    "soql",
    "sql",
    "typescript",
  ];

  for (const definition of RELEASE_PACKAGES) {
    const manifest = await readJson(`${definition.workspacePath}/package.json`);
    const keywords = manifest.keywords;
    if (
      !Array.isArray(keywords) ||
      !keywords.every((keyword) => typeof keyword === "string")
    ) {
      throw new Error(`${definition.name} keywords must be strings`);
    }
    expect(keywords).toEqual(
      [...keywords].sort((left, right) => left.localeCompare(right, "en")),
    );
    expect(keywords).toEqual(expect.arrayContaining(requiredKeywords));

    const files = manifest.files;
    expect(files).toEqual(
      expect.arrayContaining(["dist", "LICENSE", "README.md"]),
    );

    const readme = await readText(`${definition.workspacePath}/README.md`);
    expect(readme).toMatch(new RegExp(`^# ${definition.name}\\n`, "u"));
    expect(readme).toContain("## Install");
    expect(readme).toContain("pnpm add");
    expect(readme.length).toBeGreaterThan(500);
  }
});
