import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMMANDS } from "#/commands";
import Generate from "#/commands/generate";

import { field } from "./fixtures/field-filtering.js";

const mocks = vi.hoisted(() => {
  const describeGlobal = vi.fn();
  const describe = vi.fn();
  const request = vi.fn();
  const createRestClient = vi.fn((options: { apiVersion?: string }) => ({
    apiVersion: options.apiVersion ?? "65.0",
    request: async (path: string) => {
      if (path === "/sobjects/") {
        return describeGlobal();
      }
      const object = /^\/sobjects\/([A-Za-z0-9_]+)\/describe$/.exec(path);
      return object ? describe(object[1]) : request(path);
    },
  }));
  const execute = vi.fn();

  return { createRestClient, describe, describeGlobal, execute, request };
});

vi.mock("@oclif/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@oclif/core")>()),
  execute: mocks.execute,
}));

vi.mock("@kysoql/rest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kysoql/rest")>()),
  createRestClient: mocks.createRestClient,
}));

const codegenRoot = fileURLToPath(new URL("..", import.meta.url));
const commandLoadOptions = {
  root: codegenRoot,
  pjson: {
    name: "@kysoql/codegen",
    oclif: { bin: "kysoql", dirname: "kysoql" },
    version: "0.0.0",
  },
};

const originalExitCode = process.exitCode;
const authFile = fileURLToPath(new URL("./fixtures/auth.ts", import.meta.url));

const runGenerateRaw = async (args: readonly string[]): Promise<void> => {
  await Generate.run([...args], commandLoadOptions);
};

const runGenerate = async (args: readonly string[]): Promise<void> => {
  await runGenerateRaw([...args, "--auth", authFile]);
};

beforeEach(() => {
  mocks.createRestClient.mockClear();
  mocks.describe.mockReset();
  mocks.describeGlobal.mockReset();
  mocks.execute.mockReset();
  mocks.request.mockReset();
  process.exitCode = undefined;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("kysoql oclif CLI", () => {
  it("registers the generate command explicitly", () => {
    expect(COMMANDS).toEqual({ generate: Generate });
  });

  it("delegates the executable entrypoint to oclif", async () => {
    mocks.execute.mockResolvedValue(undefined);
    vi.resetModules();

    await import("#/cli");

    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute).toHaveBeenCalledWith({
      dir: expect.stringContaining("/src/cli.ts"),
    });
  });

  it("declares deterministic defaults and repeatable object flags", () => {
    expect(Generate.flags.object.multiple).toBe(true);
    expect(Generate.flags.object.multipleNonGreedy).toBe(true);
    // Defaults are applied after config loading, not by oclif before merging.
    expect(Generate.flags.output.default).toBeUndefined();
    expect(Generate.flags["schema-name"].default).toBeUndefined();
    expect(Generate.flags.config.exclusive).toContain("no-config");
  });

  it("requires an explicit authentication provider before constructing the connection", async () => {
    await expect(runGenerateRaw(["--no-config"])).rejects.toThrow(
      /Salesforce authentication is required/,
    );
    expect(mocks.createRestClient).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("lets oclif reject unknown flags", async () => {
    await expect(runGenerate(["--unknown"])).rejects.toThrow(/--unknown/);

    expect(mocks.createRestClient).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each([
    "--object",
    "--output",
    "--schema-name",
    "--config",
    "--api-version",
    "--auth",
  ])("lets oclif reject a missing value for %s", async (flag) => {
    const args = flag === "--auth" ? [flag] : ["--auth", authFile, flag];
    await expect(runGenerateRaw(args)).rejects.toThrow(
      new RegExp(flag.replace("--", "")),
    );

    expect(mocks.createRestClient).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("rejects invalid schema identifiers before connecting", async () => {
    await expect(runGenerate(["--schema-name", "not-valid"])).rejects.toThrow(
      "Invalid schema name: not-valid",
    );
    expect(mocks.createRestClient).not.toHaveBeenCalled();
  });

  it("connects, describes requested objects, writes the schema, and reports the output path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-"));
    const output = join(directory, "nested", "schema.ts");
    const log = vi
      .spyOn(Command.prototype, "log")
      .mockImplementation(() => undefined);

    mocks.describeGlobal.mockResolvedValue({
      sobjects: [
        { name: "Account", queryable: true },
        { name: "Contact", queryable: true },
      ],
    });
    mocks.describe.mockImplementation(async (objectName: string) => ({
      name: objectName,
      fields: [
        {
          name: "Id",
          type: "id",
          nillable: false,
          filterable: true,
          sortable: true,
          groupable: true,
          aggregatable: true,
          custom: false,
        },
      ],
    }));

    try {
      await runGenerate([
        "--object",
        "Account",
        "--object",
        "Contact",
        "--output",
        output,
        "--schema-name",
        "CliSchema",
      ]);

      expect(mocks.createRestClient).toHaveBeenCalledWith({
        apiVersion: "65.0",
        accessToken: "token",
        instanceUrl: "https://example.my.salesforce.com",
      });
      expect(mocks.describeGlobal).toHaveBeenCalledOnce();
      expect(mocks.describe).toHaveBeenNthCalledWith(1, "Account");
      expect(mocks.describe).toHaveBeenNthCalledWith(2, "Contact");
      expect(mocks.request).not.toHaveBeenCalled();
      await expect(readFile(output, "utf8")).resolves.toContain(
        "export interface CliSchema",
      );
      expect(log).toHaveBeenCalledWith(`Generated ${output}`);
      expect(process.exitCode).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("discovers the full Knowledge data-category tree once for Knowledge targets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-categories-"));
    const output = join(directory, "schema.ts");

    mocks.describeGlobal.mockResolvedValue({
      sobjects: [
        { name: "FAQ__kav", queryable: true },
        { name: "KnowledgeArticleVersion", queryable: true },
      ],
    });
    mocks.describe.mockImplementation(async (objectName: string) => ({
      name: objectName,
      fields: [],
    }));
    mocks.request.mockResolvedValue({
      categoryGroups: [
        {
          name: "Geography__c",
          topCategories: [
            {
              name: "All",
              childCategories: [{ name: "usa__c" }],
            },
          ],
        },
      ],
    });

    try {
      await runGenerate([
        "--object",
        "KnowledgeArticleVersion",
        "--object",
        "FAQ__kav",
        "--output",
        output,
      ]);

      expect(mocks.request).toHaveBeenCalledOnce();
      expect(mocks.request).toHaveBeenCalledWith(
        "/support/dataCategoryGroups?sObjectName=KnowledgeArticleVersion&topCategoriesOnly=false",
      );
      const source = await readFile(output, "utf8");
      expect(source.match(/readonly "Geography__c"/g)).toHaveLength(2);
      expect(source).toContain('"All" | "usa__c"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses configured output and schema name without CLI defaults masking them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-config-"));
    const configFile = join(directory, "kysoql.config.ts");
    const output = join(directory, "generated", "schema.ts");
    vi.spyOn(Command.prototype, "log").mockImplementation(() => undefined);
    mocks.describeGlobal.mockResolvedValue({
      sobjects: [
        { name: "Account", queryable: true },
        { name: "Contact", queryable: true },
      ],
    });
    mocks.describe.mockImplementation(async (name: string) => ({
      name,
      fields: [],
    }));

    try {
      await writeFile(
        configFile,
        `export default ${JSON.stringify({
          objects: ["Contact"],
          output: "generated/schema.ts",
          schemaName: "ConfiguredSchema",
        })};`,
      );
      await runGenerate(["--config", configFile]);
      expect(mocks.describe).toHaveBeenCalledOnce();
      expect(mocks.describe).toHaveBeenCalledWith("Contact");
      await expect(readFile(output, "utf8")).resolves.toContain(
        "export interface ConfiguredSchema",
      );

      mocks.describe.mockClear();
      const override = join(directory, "override.ts");
      await runGenerate([
        "--config",
        configFile,
        "--object",
        "Account",
        "--output",
        override,
        "--schema-name",
        "OverrideSchema",
      ]);
      expect(mocks.describe).toHaveBeenCalledOnce();
      expect(mocks.describe).toHaveBeenCalledWith("Account");
      await expect(readFile(override, "utf8")).resolves.toContain(
        "export interface OverrideSchema",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects conflicting config flags before connecting", async () => {
    await expect(
      runGenerate(["--config", "kysoql.config.ts", "--no-config"]),
    ).rejects.toThrow();
    expect(mocks.createRestClient).not.toHaveBeenCalled();
  });

  it("validates configuration before resolving authentication or connecting", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "kysoql-cli-invalid-config-"),
    );
    const configFile = join(directory, "kysoql.config.ts");
    try {
      await writeFile(configFile, 'export default { output: "" };');
      await expect(runGenerate(["--config", configFile])).rejects.toThrow(
        /Invalid Kysoql config/,
      );
      expect(mocks.createRestClient).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves non-Error failures from Salesforce", async () => {
    mocks.describeGlobal.mockRejectedValueOnce("connection failed");

    await expect(runGenerate([])).rejects.toBe("connection failed");
    expect(process.exitCode).toBe(1);
  });
});

describe("CLI field filtering", () => {
  it("keeps selected objects' rules through overrides and bypasses them with --no-config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-fields-"));
    const configFile = join(directory, "kysoql.config.ts");
    const output = join(directory, "filtered.ts");
    vi.spyOn(Command.prototype, "log").mockImplementation(() => undefined);
    mocks.describeGlobal.mockResolvedValue({
      sobjects: [
        { name: "Account", queryable: true },
        { name: "Contact", queryable: true },
      ],
    });
    mocks.describe.mockImplementation(async (name: string) => ({
      name,
      fields: [field("Id"), field("Name")],
    }));
    try {
      await writeFile(
        configFile,
        `export default ${JSON.stringify({
          objects: ["Contact"],
          fields: {
            Account: { include: ["Id"] },
            Contact: { include: ["NotDescribed"] },
          },
          output: "filtered.ts",
        })};`,
      );
      await runGenerate(["--config", configFile, "--object", "Account"]);
      expect(mocks.describe).toHaveBeenCalledOnce();
      expect(mocks.describe).toHaveBeenCalledWith("Account");
      const filtered = await readFile(output, "utf8");
      expect(filtered).toContain('readonly "Id": SalesforceField<');
      expect(filtered).not.toContain('readonly "Name": SalesforceField<');
      expect(filtered).toContain('    "none",\n    false\n  >;');

      const fullOutput = join(directory, "full.ts");
      await runGenerate([
        "--no-config",
        "--object",
        "Account",
        "--output",
        fullOutput,
      ]);
      expect(await readFile(fullOutput, "utf8")).toContain(
        'readonly "Name": SalesforceField<',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects invalid field rules before authentication or a connection are needed", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "kysoql-cli-invalid-fields-"),
    );
    const configFile = join(directory, "kysoql.config.ts");
    try {
      await writeFile(
        configFile,
        "export default { fields: { Account: { include: [] } } };",
      );
      await expect(runGenerate(["--config", configFile])).rejects.toThrow(
        /kysoql\.config\.ts: fields\.Account\.include/,
      );
      expect(mocks.createRestClient).not.toHaveBeenCalled();
      expect(mocks.describeGlobal).not.toHaveBeenCalled();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("native REST CLI version selection", () => {
  it("applies flag > config > pinned default without reading SF_* environment variables", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-version-"));
    const configFile = join(directory, "kysoql.config.ts");
    const output = join(directory, "schema.ts");
    vi.spyOn(Command.prototype, "log").mockImplementation(() => undefined);
    vi.stubEnv("SF_ACCESS_TOKEN", "ignored-token");
    vi.stubEnv("SF_INSTANCE_URL", "https://ignored.example.com");
    vi.stubEnv("SF_API_VERSION", "64.0");
    mocks.describeGlobal.mockResolvedValue({
      sobjects: [{ name: "Account", queryable: true }],
    });
    mocks.describe.mockResolvedValue({ name: "Account", fields: [] });
    try {
      await writeFile(
        configFile,
        `export default {
          auth: async () => ({ accessToken: "config-token", instanceUrl: "https://config.my.salesforce.com" }),
          objects: ["Account"],
          apiVersion: "66.0"
        };`,
      );
      await runGenerate([
        "--no-config",
        "--object",
        "Account",
        "--output",
        output,
      ]);
      expect(mocks.createRestClient).toHaveBeenLastCalledWith({
        apiVersion: "65.0",
        accessToken: "token",
        instanceUrl: "https://example.my.salesforce.com",
      });
      await runGenerateRaw(["--config", configFile, "--output", output]);
      expect(mocks.createRestClient).toHaveBeenLastCalledWith({
        apiVersion: "66.0",
        accessToken: "config-token",
        instanceUrl: "https://config.my.salesforce.com",
      });
      await runGenerateRaw([
        "--config",
        configFile,
        "--api-version",
        "67.0",
        "--output",
        output,
      ]);
      expect(mocks.createRestClient).toHaveBeenLastCalledWith(
        expect.objectContaining({ apiVersion: "67.0" }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(["", "v65.0", "../query"])(
    "rejects invalid --api-version %j before connecting",
    async (value) => {
      await expect(
        runGenerate(["--no-config", "--api-version", value]),
      ).rejects.toThrow(/apiVersion/);
      expect(mocks.createRestClient).not.toHaveBeenCalled();
    },
  );
});
