import { describe, expect, it } from "vitest";

import { cliUsage, parseCli } from "../src/cli-options.js";

describe("parseCli", () => {
  it("returns help when no arguments are provided", () => {
    expect(parseCli([])).toEqual({ kind: "help" });
  });

  it("returns help when --help appears anywhere in the arguments", () => {
    expect(parseCli(["generate", "--object", "Account", "--help"])).toEqual({
      kind: "help",
    });
  });

  it("exports usage for every supported option and environment variable", () => {
    expect(cliUsage).toContain("kysoql generate [options]");
    expect(cliUsage).toContain("--output <path>");
    expect(cliUsage).toContain("--object <api-name>");
    expect(cliUsage).toContain("--schema-name <name>");
    expect(cliUsage).toContain("--help");
    expect(cliUsage).toContain("SF_INSTANCE_URL");
    expect(cliUsage).toContain("SF_ACCESS_TOKEN");
  });

  it("uses deterministic generate defaults", () => {
    expect(parseCli(["generate"])).toEqual({
      kind: "generate",
      options: {
        objects: [],
        output: "salesforce.generated.ts",
        schemaName: "SalesforceSchema",
      },
    });
  });

  it.each(["Schema", "_Schema", "$Schema", "Schema9"])(
    "accepts valid TypeScript schema identifiers: %s",
    (schemaName) => {
      expect(parseCli(["generate", "--schema-name", schemaName])).toEqual({
        kind: "generate",
        options: {
          objects: [],
          output: "salesforce.generated.ts",
          schemaName,
        },
      });
    },
  );

  it("accepts an argument separator after generate", () => {
    expect(
      parseCli([
        "generate",
        "--",
        "--object",
        "Account",
        "--output",
        "generated.ts",
      ]),
    ).toEqual({
      kind: "generate",
      options: {
        objects: ["Account"],
        output: "generated.ts",
        schemaName: "SalesforceSchema",
      },
    });
  });

  it("parses every generate option and repeatable object filters", () => {
    expect(
      parseCli([
        "generate",
        "--object",
        "Account",
        "--object",
        "Kysoql_Record__c",
        "--output",
        "generated.ts",
        "--schema-name",
        "$Generated_Schema",
      ]),
    ).toEqual({
      kind: "generate",
      options: {
        objects: ["Account", "Kysoql_Record__c"],
        output: "generated.ts",
        schemaName: "$Generated_Schema",
      },
    });
  });

  it("rejects unknown commands", () => {
    expect(() => parseCli(["describe"])).toThrow("Unknown command: describe");
  });

  it("rejects unknown options", () => {
    expect(() => parseCli(["generate", "--unknown"])).toThrow(
      "Unknown option: --unknown",
    );
  });

  it.each(["--object", "--output", "--schema-name"])(
    "rejects a missing value for %s",
    (flag) => {
      expect(() => parseCli(["generate", flag])).toThrow(
        `${flag} requires a value.`,
      );
    },
  );

  it.each(["--object", "--output", "--schema-name"])(
    "does not consume another option as the value for %s",
    (flag) => {
      expect(() => parseCli(["generate", flag, "--help-disabled"])).toThrow(
        `${flag} requires a value.`,
      );
    },
  );

  it.each([
    "not-valid",
    "9Invalid",
    "with space",
    "Salesforce.Schema",
    "",
  ])("rejects invalid schema identifiers: %j", (schemaName) => {
    expect(() =>
      parseCli(["generate", "--schema-name", schemaName]),
    ).toThrow(
      schemaName.length === 0
        ? "--schema-name requires a value."
        : `Invalid schema name: ${schemaName}`,
    );
  });
});
