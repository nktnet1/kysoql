import { describe, expect, it } from "vitest";

import { parseCli } from "./cli-options.js";

describe("parseCli", () => {
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

  it("parses repeatable object filters", () => {
    expect(
      parseCli([
        "generate",
        "--object",
        "Account",
        "--object",
        "Kysoql_Record__c",
        "--output",
        "generated.ts",
      ]),
    ).toEqual({
      kind: "generate",
      options: {
        objects: ["Account", "Kysoql_Record__c"],
        output: "generated.ts",
        schemaName: "SalesforceSchema",
      },
    });
  });

  it("rejects unknown options", () => {
    expect(() => parseCli(["generate", "--unknown"])).toThrow(
      "Unknown option: --unknown",
    );
  });

  it("rejects invalid schema identifiers", () => {
    expect(() => parseCli(["generate", "--schema-name", "not-valid"])).toThrow(
      "Invalid schema name: not-valid",
    );
  });
});
