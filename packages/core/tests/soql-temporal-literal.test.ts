import { describe, expect, it } from "vitest";

import { soqlDate, soqlDateTime, soqlTime } from "../src/soql-temporal-literal.js";

describe("SOQL temporal literals", () => {
  it("creates frozen date literals", () => {
    const literal = soqlDate("2024-02-29");

    expect(literal).toEqual({
      kind: "SoqlDateLiteral",
      value: "2024-02-29",
    });
    expect(Object.isFrozen(literal)).toBe(true);
  });

  it("rejects invalid date literals", () => {
    for (const value of [
      "2026-2-03",
      "2023-02-29",
      "2026-04-31",
      "1699-12-31",
      "4001-01-01",
    ]) {
      expect(() => soqlDate(value)).toThrow(TypeError);
    }
  });

  it("accepts supported dateTime forms with UTC or explicit offsets", () => {
    expect(soqlDateTime("2026-09-17T16:26:30Z").value).toBe(
      "2026-09-17T16:26:30Z",
    );
    expect(soqlDateTime("2026-09-17T16:26:30+10:00").value).toBe(
      "2026-09-17T16:26:30+10:00",
    );
    expect(soqlDateTime("2026-09-17T16:26:30.125-08:00").value).toBe(
      "2026-09-17T16:26:30.125-08:00",
    );
  });

  it("rejects invalid dateTime literals", () => {
    for (const value of [
      "2026-09-17 16:26:30Z",
      "2026-09-17T24:00:00Z",
      "2026-09-17T16:60:00Z",
      "2026-09-17T16:26:60Z",
      "2026-09-17T16:26:30",
      "2026-09-17T16:26:30z",
      "2026-09-17T16:26:30+14:01",
      "2026-09-17T16:26:30+15:00",
    ]) {
      expect(() => soqlDateTime(value)).toThrow(TypeError);
    }
  });

  it("accepts Salesforce time values with optional milliseconds", () => {
    expect(soqlTime("07:30:45Z").value).toBe("07:30:45Z");
    expect(soqlTime("07:30:45.125Z").value).toBe("07:30:45.125Z");
  });

  it("rejects invalid time literals", () => {
    for (const value of [
      "7:30:45Z",
      "07:30Z",
      "24:00:00Z",
      "07:60:00Z",
      "07:30:60Z",
      "07:30:45.12Z",
      "07:30:45+10:00",
      "07:30:45",
    ]) {
      expect(() => soqlTime(value)).toThrow(TypeError);
    }
  });
});
