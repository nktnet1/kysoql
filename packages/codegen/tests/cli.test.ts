import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMMANDS } from "#/commands";
import Generate from "#/commands/generate";

const mocks = vi.hoisted(() => {
  const describeGlobal = vi.fn();
  const describe = vi.fn();
  const connection = { describeGlobal, describe };
  const Connection = vi.fn(function MockConnection() {
    return connection;
  });
  const execute = vi.fn();

  return { Connection, describe, describeGlobal, execute };
});

vi.mock("@oclif/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@oclif/core")>()),
  execute: mocks.execute,
}));

vi.mock("jsforce", () => ({ Connection: mocks.Connection }));

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
const originalAccessToken = process.env.SF_ACCESS_TOKEN;
const originalInstanceUrl = process.env.SF_INSTANCE_URL;

const restoreEnvironmentVariable = (
  name: "SF_ACCESS_TOKEN" | "SF_INSTANCE_URL",
  value: string | undefined,
): void => {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};

const runGenerate = async (args: readonly string[]): Promise<void> => {
  await Generate.run([...args], commandLoadOptions);
};

beforeEach(() => {
  mocks.Connection.mockClear();
  mocks.describe.mockReset();
  mocks.describeGlobal.mockReset();
  mocks.execute.mockReset();
  process.exitCode = undefined;
  delete process.env.SF_ACCESS_TOKEN;
  delete process.env.SF_INSTANCE_URL;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  restoreEnvironmentVariable("SF_ACCESS_TOKEN", originalAccessToken);
  restoreEnvironmentVariable("SF_INSTANCE_URL", originalInstanceUrl);
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
    expect(Generate.flags.output.default).toBe("salesforce.generated.ts");
    expect(Generate.flags["schema-name"].default).toBe("SalesforceSchema");
  });

  it("requires an access token before constructing the connection", async () => {
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";

    await expect(runGenerate([])).rejects.toThrow(
      "SF_ACCESS_TOKEN is required.",
    );
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("requires an instance URL before constructing the connection", async () => {
    process.env.SF_ACCESS_TOKEN = "token";

    await expect(runGenerate([])).rejects.toThrow(
      "SF_INSTANCE_URL is required.",
    );
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each(["SF_ACCESS_TOKEN", "SF_INSTANCE_URL"] as const)(
    "rejects an empty %s value",
    async (name) => {
      process.env.SF_ACCESS_TOKEN = "token";
      process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
      process.env[name] = "";

      await expect(runGenerate([])).rejects.toThrow(`${name} is required.`);
      expect(mocks.Connection).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it("lets oclif reject unknown flags", async () => {
    await expect(runGenerate(["--unknown"])).rejects.toThrow(/--unknown/);

    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each(["--object", "--output", "--schema-name"])(
    "lets oclif reject a missing value for %s",
    async (flag) => {
      await expect(runGenerate([flag])).rejects.toThrow(
        new RegExp(flag.replace("--", "")),
      );

      expect(mocks.Connection).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it("rejects invalid schema identifiers before connecting", async () => {
    process.env.SF_ACCESS_TOKEN = "token";
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";

    await expect(runGenerate(["--schema-name", "not-valid"])).rejects.toThrow(
      "Invalid schema name: not-valid",
    );
    expect(mocks.Connection).not.toHaveBeenCalled();
  });

  it("connects, describes requested objects, writes the schema, and reports the output path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-"));
    const output = join(directory, "nested", "schema.ts");
    const log = vi
      .spyOn(Command.prototype, "log")
      .mockImplementation(() => undefined);

    process.env.SF_ACCESS_TOKEN = "token";
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
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

      expect(mocks.Connection).toHaveBeenCalledWith({
        accessToken: "token",
        instanceUrl: "https://example.my.salesforce.com",
      });
      expect(mocks.describeGlobal).toHaveBeenCalledOnce();
      expect(mocks.describe).toHaveBeenNthCalledWith(1, "Account");
      expect(mocks.describe).toHaveBeenNthCalledWith(2, "Contact");
      await expect(readFile(output, "utf8")).resolves.toContain(
        "export interface CliSchema",
      );
      expect(log).toHaveBeenCalledWith(`Generated ${output}`);
      expect(process.exitCode).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves non-Error failures from Salesforce", async () => {
    process.env.SF_ACCESS_TOKEN = "token";
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
    mocks.describeGlobal.mockRejectedValueOnce("connection failed");

    await expect(runGenerate([])).rejects.toBe("connection failed");
    expect(process.exitCode).toBe(1);
  });
});
