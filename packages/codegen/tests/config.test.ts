import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import {
  defineConfig,
  type KysoqlConfig,
  type ObjectFieldFilters,
} from "#/config";
import {
  loadConfig,
  parseKysoqlConfig,
  resolveGenerateOptions,
} from "#/config-loader";

const directories: string[] = [];
const temporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "kysoql-config-"));
  directories.push(directory);
  return directory;
};
const writeConfig = async (
  directory: string,
  source: string,
  filename = "kysoql.config.ts",
): Promise<string> => {
  const target = join(directory, filename);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source, "utf8");
  return target;
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("defineConfig", () => {
  it("is a side-effect-free, typed identity helper", () => {
    const config = { objects: ["Account"] as const, output: "src/schema.ts" };
    expect(defineConfig(config)).toBe(config);
    expectTypeOf(defineConfig(config)).toEqualTypeOf<KysoqlConfig>();
    expectTypeOf(defineConfig({})).toEqualTypeOf<KysoqlConfig>();
  });

  it("rejects misspelled keys and invalid option types at compile time", () => {
    // @ts-expect-error Use output, not out.
    defineConfig({ out: "schema.ts" });
    // @ts-expect-error Object API names must be an array.
    defineConfig({ objects: "Account" });
    // @ts-expect-error Credentials belong in the process environment.
    defineConfig({ accessToken: "not-a-token" });
    // @ts-expect-error Export an object, not a configuration factory.
    defineConfig(() => ({}));
  });
});

describe("configuration validation", () => {
  it("accepts an empty config and an explicit empty object list", () => {
    expect(parseKysoqlConfig({})).toEqual({});
    expect(parseKysoqlConfig({ objects: [] })).toEqual({ objects: [] });
  });

  it.each([
    null,
    [],
    true,
    new Date(0),
    Promise.resolve({}),
    "schema.ts",
    () => ({}),
    { out: "schema.ts" },
    { apiVersion: "v65.0" },
    { apiVersion: "65" },
    { apiVersion: 65 },
    { apiVersion: "65.1" },
    { objects: "Account" },
    { objects: ["Account", 42] },
    { objects: [" "] },
    { output: "" },
    { output: "   " },
    { schemaName: "" },
    { schemaName: "not-valid" },
  ])("rejects invalid config %#", (value) => {
    expect(() => parseKysoqlConfig(value)).toThrow();
  });
});

describe("configuration discovery and loading", () => {
  it("does not require a file or walk into parent directories", async () => {
    const directory = await temporaryDirectory();
    const child = join(directory, "app");
    await mkdir(child);
    await writeConfig(directory, 'throw new Error("must not be loaded");');
    await expect(loadConfig({ cwd: child })).resolves.toBeUndefined();
  });

  it.each(["ts", "mts", "js", "mjs"])(
    "loads a default-exported .%s config",
    async (extension) => {
      const directory = await temporaryDirectory();
      const filename = await writeConfig(
        directory,
        `export default ${JSON.stringify({
          objects: ["Account"],
          output: "src/schema.ts",
          schemaName: "OrgSchema",
        })};`,
        `kysoql.config.${extension}`,
      );
      await expect(loadConfig({ cwd: directory })).resolves.toEqual({
        filename,
        config: {
          objects: ["Account"],
          output: "src/schema.ts",
          schemaName: "OrgSchema",
        },
      });
    },
  );

  it.each(["cts", "cjs"])(
    "loads module.exports from .%s",
    async (extension) => {
      const directory = await temporaryDirectory();
      await writeConfig(
        directory,
        'module.exports = { objects: ["Contact"] };',
        `kysoql.config.${extension}`,
      );
      expect((await loadConfig({ cwd: directory }))?.config.objects).toEqual([
        "Contact",
      ]);
    },
  );

  it("loads typed configs and extensionless TypeScript helpers", async () => {
    const directory = await temporaryDirectory();
    const helper = fileURLToPath(new URL("../src/config.ts", import.meta.url));
    await writeFile(
      join(directory, "objects.ts"),
      'export const objects: readonly string[] = ["Account", "Contact"];',
    );
    await writeConfig(
      directory,
      `
      import { defineConfig } from ${JSON.stringify(helper)};
      import { objects } from "./objects";
      export default defineConfig({ objects, output: "src/schema.ts" });
    `,
    );
    expect((await loadConfig({ cwd: directory }))?.config.objects).toEqual([
      "Account",
      "Contact",
    ]);
  });

  it("resolves an explicit file relative to cwd", async () => {
    const directory = await temporaryDirectory();
    const filename = await writeConfig(
      directory,
      'export default { output: "generated/schema.ts" };',
      "config/sandbox.ts",
    );
    expect(
      await loadConfig({ cwd: directory, configFile: "config/sandbox.ts" }),
    ).toEqual({
      filename,
      config: { output: "generated/schema.ts" },
    });
    expect(
      (await loadConfig({ cwd: directory, configFile: filename }))?.filename,
    ).toBe(filename);
  });

  it("rejects ambiguous discovery but allows explicit selection", async () => {
    const directory = await temporaryDirectory();
    await writeConfig(directory, "export default {};", "kysoql.config.ts");
    await writeConfig(directory, "export default {};", "kysoql.config.mjs");
    await expect(loadConfig({ cwd: directory })).rejects.toThrow(
      /Multiple Kysoql config files.*--config/,
    );
    await expect(
      loadConfig({ cwd: directory, configFile: "kysoql.config.ts" }),
    ).resolves.toMatchObject({ config: {} });
  });

  it("rejects an explicit missing file rather than falling back to defaults", async () => {
    const directory = await temporaryDirectory();
    await expect(
      loadConfig({ cwd: directory, configFile: "missing.ts" }),
    ).rejects.toThrow(/config not found/);
  });

  it("rejects empty paths, unsupported formats, and directories", async () => {
    const directory = await temporaryDirectory();
    await expect(
      loadConfig({ cwd: directory, configFile: " " }),
    ).rejects.toThrow(/non-blank path/);
    await expect(
      loadConfig({ cwd: directory, configFile: "config.json" }),
    ).rejects.toThrow(/Unsupported/);
    await mkdir(join(directory, "kysoql.config.ts"));
    await expect(loadConfig({ cwd: directory })).rejects.toThrow(/not a file/);
  });

  it("does not evaluate any config when disabled", async () => {
    const directory = await temporaryDirectory();
    await writeConfig(directory, 'throw new Error("must not be loaded");');
    await expect(
      loadConfig({ cwd: directory, disabled: true }),
    ).resolves.toBeUndefined();
    await expect(
      loadConfig({
        cwd: directory,
        disabled: true,
        configFile: "kysoql.config.ts",
      }),
    ).rejects.toThrow(/cannot be used together/);
  });

  it("identifies config import failures and retains the cause", async () => {
    const directory = await temporaryDirectory();
    const filename = await writeConfig(
      directory,
      'throw new Error("configuration failed");',
    );
    await expect(loadConfig({ cwd: directory })).rejects.toMatchObject({
      message: expect.stringContaining(filename),
      cause: expect.objectContaining({ message: "configuration failed" }),
    });
  });

  it("requires a default export and validates JavaScript configs at runtime", async () => {
    const directory = await temporaryDirectory();
    await writeConfig(directory, 'export const output = "schema.ts";');
    await expect(loadConfig({ cwd: directory })).rejects.toThrow(
      /default-exported/,
    );
    await writeConfig(directory, 'export default { out: "schema.ts" };');
    await expect(loadConfig({ cwd: directory })).rejects.toThrow(
      /Invalid Kysoql config/,
    );
  });

  it("does not return stale config after the file changes", async () => {
    const directory = await temporaryDirectory();
    await writeConfig(
      directory,
      'export default { schemaName: "FirstSchema" };',
    );
    expect((await loadConfig({ cwd: directory }))?.config.schemaName).toBe(
      "FirstSchema",
    );
    await writeConfig(
      directory,
      'export default { schemaName: "SecondSchema" };',
    );
    expect((await loadConfig({ cwd: directory }))?.config.schemaName).toBe(
      "SecondSchema",
    );
  });
});

describe("generation option precedence", () => {
  const cwd = resolve("workspace/app");
  const filename = resolve("workspace/config/kysoql.config.ts");
  const loaded = {
    filename,
    config: {
      objects: ["Account", "Contact"],
      output: "generated/schema.ts",
      schemaName: "ConfiguredSchema",
    },
  };

  it("keeps the existing defaults when no config is present", () => {
    expect(resolveGenerateOptions({}, undefined, cwd)).toEqual({
      objects: [],
      output: join(cwd, "salesforce.generated.ts"),
      schemaName: "SalesforceSchema",
    });
  });

  it("uses configured values and resolves output beside the config", () => {
    expect(resolveGenerateOptions({}, loaded, cwd)).toEqual({
      objects: ["Account", "Contact"],
      output: resolve(dirname(filename), "generated/schema.ts"),
      schemaName: "ConfiguredSchema",
    });
  });

  it("replaces config values with flags rather than merging object lists", () => {
    expect(
      resolveGenerateOptions(
        {
          object: ["Opportunity"],
          output: "override.ts",
          "schema-name": "OverrideSchema",
        },
        loaded,
        cwd,
      ),
    ).toEqual({
      objects: ["Opportunity"],
      output: join(cwd, "override.ts"),
      schemaName: "OverrideSchema",
    });
  });

  it("treats an explicit empty object list as all queryable objects", () => {
    expect(resolveGenerateOptions({ object: [] }, loaded, cwd).objects).toEqual(
      [],
    );
  });

  it("resolves the default output beside a loaded config", () => {
    expect(
      resolveGenerateOptions({}, { filename, config: {} }, cwd).output,
    ).toBe(join(dirname(filename), "salesforce.generated.ts"));
  });

  it("preserves absolute output paths and never mutates the config", () => {
    const output = resolve("absolute/generated.ts");
    expect(resolveGenerateOptions({ output }, loaded, cwd).output).toBe(output);
    expect(loaded.config.output).toBe("generated/schema.ts");
  });
});

describe("field filter configuration", () => {
  const fields: ObjectFieldFilters = {
    Account: { include: ["Id", "Name"] },
    Contact: { exclude: ["Description"] },
  };

  it("exports the typed configuration and preserves field rules", () => {
    expect(defineConfig({ fields }).fields).toBe(fields);
    expect(parseKysoqlConfig({ fields })).toEqual({ fields });
    defineConfig({
      // @ts-expect-error Each object must use exactly one filtering mode.
      fields: { Account: { include: ["Id"], exclude: ["Name"] } },
    });
    // @ts-expect-error Field rules cannot be empty objects.
    defineConfig({ fields: { Account: {} } });
    // @ts-expect-error Only arrays of exact API names are supported.
    defineConfig({ fields: { Account: { include: /__c$/ } } });
  });

  it("validates JavaScript field rules with the config filename", () => {
    expect(() =>
      parseKysoqlConfig(
        { fields: { Account: { include: [] } } },
        "config in kysoql.config.ts",
      ),
    ).toThrow(/kysoql\.config\.ts: fields\.Account\.include/);
  });

  it("loads field filters from a real TypeScript config", async () => {
    const directory = await temporaryDirectory();
    await writeConfig(
      directory,
      `export default ${JSON.stringify({ fields })};`,
    );
    expect((await loadConfig({ cwd: directory }))?.config.fields).toEqual(
      fields,
    );
  });

  it("does not implicitly add objects and retains rules through CLI overrides", () => {
    const loaded = {
      filename: resolve("kysoql.config.ts"),
      config: { objects: ["Account", "Contact"], fields },
    };
    const options = resolveGenerateOptions({ object: ["Account"] }, loaded);
    expect(options.objects).toEqual(["Account"]);
    expect(options.fields).toEqual(fields);
    expect(
      resolveGenerateOptions({}, { ...loaded, config: { fields } }).objects,
    ).toEqual([]);
    expect(loaded.config.objects).toEqual(["Account", "Contact"]);
  });
});
