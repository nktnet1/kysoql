import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const describeGlobal = vi.fn();
  const describe = vi.fn();
  const connection = { describeGlobal, describe };
  const Connection = vi.fn(function MockConnection() {
    return connection;
  });

  return { Connection, describe, describeGlobal };
});

vi.mock("jsforce", () => ({ Connection: mocks.Connection }));

const originalArgv = process.argv;
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

const runCli = async (args: readonly string[]): Promise<void> => {
  process.argv = ["node", "kysoql", ...args];
  vi.resetModules();
  await import("#/cli");
};

beforeEach(() => {
  mocks.Connection.mockClear();
  mocks.describe.mockReset();
  mocks.describeGlobal.mockReset();
  process.exitCode = undefined;
  delete process.env.SF_ACCESS_TOKEN;
  delete process.env.SF_INSTANCE_URL;
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  restoreEnvironmentVariable("SF_ACCESS_TOKEN", originalAccessToken);
  restoreEnvironmentVariable("SF_INSTANCE_URL", originalInstanceUrl);
  vi.restoreAllMocks();
});

describe("kysoql CLI", () => {
  it("prints help without requiring Salesforce credentials", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runCli(["--help"]);

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toContain("Usage: kysoql generate [options]");
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("reports parsing failures without attempting a Salesforce connection", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await runCli(["unknown"]);

    expect(error).toHaveBeenCalledWith("Unknown command: unknown");
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("requires an access token before constructing the connection", async () => {
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await runCli(["generate"]);

    expect(error).toHaveBeenCalledWith("SF_ACCESS_TOKEN is required.");
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("requires an instance URL before constructing the connection", async () => {
    process.env.SF_ACCESS_TOKEN = "token";
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await runCli(["generate"]);

    expect(error).toHaveBeenCalledWith("SF_INSTANCE_URL is required.");
    expect(mocks.Connection).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it.each(["SF_ACCESS_TOKEN", "SF_INSTANCE_URL"] as const)(
    "rejects an empty %s value",
    async (name) => {
      process.env.SF_ACCESS_TOKEN = "token";
      process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
      process.env[name] = "";
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      await runCli(["generate"]);

      expect(error).toHaveBeenCalledWith(`${name} is required.`);
      expect(mocks.Connection).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it("connects, describes requested objects, writes the schema, and reports the output path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kysoql-cli-"));
    const output = join(directory, "nested", "schema.ts");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    process.env.SF_ACCESS_TOKEN = "token";
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
    mocks.describeGlobal.mockResolvedValue({
      sobjects: [{ name: "Account", queryable: true }],
    });
    mocks.describe.mockResolvedValue({
      name: "Account",
      fields: [
        {
          name: "Id",
          type: "id",
          nillable: false,
          filterable: true,
          sortable: true,
          groupable: true,
          aggregatable: true,
        },
      ],
    });

    try {
      await runCli([
        "generate",
        "--object",
        "Account",
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
      expect(mocks.describe).toHaveBeenCalledWith("Account");
      await expect(readFile(output, "utf8")).resolves.toContain(
        "export interface CliSchema",
      );
      expect(log).toHaveBeenCalledWith(`Generated ${output}`);
      expect(process.exitCode).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports non-Error failures without rewriting them", async () => {
    process.env.SF_ACCESS_TOKEN = "token";
    process.env.SF_INSTANCE_URL = "https://example.my.salesforce.com";
    mocks.describeGlobal.mockRejectedValueOnce("connection failed");
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await runCli(["generate"]);

    expect(error).toHaveBeenCalledWith("connection failed");
    expect(process.exitCode).toBe(1);
  });
});
