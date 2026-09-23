import { describe, expect, it } from "vitest";

import {
  parseScratchDurationDays,
  readSalesforceSetupEnvironment,
  readSalesforceTargetEnvironment,
  readSchemaGenerationEnvironment,
} from "./environment.ts";

describe("script environment validation", () => {
  it("provides deterministic Salesforce defaults", () => {
    expect(readSalesforceTargetEnvironment({})).toEqual({
      KYSOQL_TARGET_ORG: "kysoql-test",
    });
    expect(readSalesforceSetupEnvironment({})).toEqual({
      KYSOQL_DEV_HUB_ALIAS: "kysoql-dev-hub",
      KYSOQL_SCRATCH_ALIAS: "kysoql-test",
      KYSOQL_SCRATCH_DURATION_DAYS: "30",
    });
  });

  it("rejects empty environment aliases", () => {
    expect(() =>
      readSalesforceTargetEnvironment({ KYSOQL_TARGET_ORG: "  " }),
    ).toThrow("KYSOQL_TARGET_ORG must not be empty.");
  });

  it("validates schema-generation org aliases without Salesforce token variables", () => {
    expect(
      readSchemaGenerationEnvironment({ KYSOQL_TARGET_ORG: "sandbox" }),
    ).toEqual({ KYSOQL_TARGET_ORG: "sandbox" });
    expect(() =>
      readSchemaGenerationEnvironment({ KYSOQL_TARGET_ORG: "  " }),
    ).toThrow("KYSOQL_TARGET_ORG must not be empty.");
  });

  it("validates scratch duration bounds", () => {
    expect(parseScratchDurationDays("1")).toBe(1);
    expect(parseScratchDurationDays(30)).toBe(30);
    expect(() => parseScratchDurationDays("0")).toThrow(
      "Scratch duration must be between 1 and 30 days.",
    );
    expect(() => parseScratchDurationDays("31")).toThrow(
      "Scratch duration must be between 1 and 30 days.",
    );
  });
});
