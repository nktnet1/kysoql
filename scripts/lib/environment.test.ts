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

  it("requires Salesforce schema credentials as a pair", () => {
    expect(() =>
      readSchemaGenerationEnvironment({ SF_ACCESS_TOKEN: "token" }),
    ).toThrow(
      "SF_ACCESS_TOKEN and SF_INSTANCE_URL must either both be set or both be unset.",
    );
  });

  it("validates schema-generation URLs", () => {
    expect(() =>
      readSchemaGenerationEnvironment({
        SF_ACCESS_TOKEN: "token",
        SF_INSTANCE_URL: "not-a-url",
      }),
    ).toThrow("SF_INSTANCE_URL must be a valid URL.");
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
