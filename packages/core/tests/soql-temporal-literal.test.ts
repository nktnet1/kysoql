import { describe, expect, it } from "vitest";

import {
  isSoqlTemporalLiteral,
  soqlDate,
  soqlDateTime,
  soqlTime,
} from "#src/soql-temporal-literal";

describe("SOQL temporal literals", () => {
  it("creates frozen date, dateTime, and time literals", () => {
    const date = soqlDate("2024-02-29");
    const dateTime = soqlDateTime("2026-09-17T16:26:30.125+10:00");
    const time = soqlTime("07:30:45.125Z");

    expect(date).toEqual({
      kind: "SoqlDateLiteral",
      value: "2024-02-29",
    });
    expect(dateTime).toEqual({
      kind: "SoqlDateTimeLiteral",
      value: "2026-09-17T16:26:30.125+10:00",
    });
    expect(time).toEqual({
      kind: "SoqlTimeLiteral",
      value: "07:30:45.125Z",
    });
    expect(Object.isFrozen(date)).toBe(true);
    expect(Object.isFrozen(dateTime)).toBe(true);
    expect(Object.isFrozen(time)).toBe(true);
  });

  it.each([
    "1700-01-01",
    "1900-02-28",
    "2000-02-29",
    "2024-02-29",
    "2026-04-30",
    "2026-06-30",
    "2026-09-30",
    "2026-11-30",
    "2026-12-31",
    "4000-12-31",
  ])(
    "accepts valid dates at calendar and Salesforce boundaries: %s",
    (value) => {
      expect(soqlDate(value).value).toBe(value);
    },
  );

  it.each([
    "2026-2-03",
    "2026-02-3",
    "2026/02/03",
    "1699-12-31",
    "4001-01-01",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-01-32",
    "2026-04-31",
    "2026-06-31",
    "2026-09-31",
    "2026-11-31",
    "2023-02-29",
    "1900-02-29",
  ])("rejects invalid date literals: %s", (value) => {
    expect(() => soqlDate(value)).toThrow(TypeError);
  });

  it.each([
    "2026-09-17T16:26:30Z",
    "2026-09-17T16:26:30.125Z",
    "2026-09-17T00:00:00+00:00",
    "2026-09-17T23:59:59+14:00",
    "2026-09-17T23:59:59-14:00",
    "2026-09-17T16:26:30+10:59",
    "2024-02-29T16:26:30-08:00",
  ])("accepts supported dateTime forms: %s", (value) => {
    expect(soqlDateTime(value).value).toBe(value);
  });

  it.each([
    "2026-09-17 16:26:30Z",
    "2026-09-17T16:26Z",
    "2026-09-17T16:26:30.1Z",
    "2026-09-17T16:26:30.12Z",
    "2026-09-17T16:26:30.1234Z",
    "2026-09-17T16:26:30",
    "2026-09-17T16:26:30z",
    "2026-09-17T24:00:00Z",
    "2026-09-17T16:60:00Z",
    "2026-09-17T16:26:60Z",
    "2023-02-29T16:26:30Z",
    "1699-12-31T16:26:30Z",
    "4001-01-01T16:26:30Z",
    "2026-09-17T16:26:30+14:01",
    "2026-09-17T16:26:30-14:01",
    "2026-09-17T16:26:30+15:00",
    "2026-09-17T16:26:30+10:60",
  ])("rejects invalid dateTime literals: %s", (value) => {
    expect(() => soqlDateTime(value)).toThrow(TypeError);
  });

  it.each(["00:00:00Z", "07:30:45Z", "07:30:45.125Z", "23:59:59.999Z"])(
    "accepts supported time forms: %s",
    (value) => {
      expect(soqlTime(value).value).toBe(value);
    },
  );

  it("preserves validation error messages", () => {
    expect(() => soqlDate("2026-02-30")).toThrow(
      "SOQL date literals contain an invalid date.",
    );
    expect(() => soqlDateTime("2026-09-17 16:26:30Z")).toThrow(
      "SOQL dateTime literals must use YYYY-MM-DDThh:mm:ss[.SSS]Z or YYYY-MM-DDThh:mm:ss[.SSS]+/-hh:mm.",
    );
    expect(() => soqlDateTime("2023-02-29T16:26:30Z")).toThrow(
      "SOQL dateTime literals contain an invalid date.",
    );
    expect(() => soqlDateTime("2026-09-17T24:00:00Z")).toThrow(
      "SOQL dateTime literals contain an invalid time.",
    );
    expect(() => soqlDateTime("2026-09-17T16:26:30+14:01")).toThrow(
      "SOQL dateTime literals contain an invalid UTC offset.",
    );
    expect(() => soqlTime("07:30:45")).toThrow(
      "SOQL time literals must use hh:mm:ssZ or hh:mm:ss.SSSZ.",
    );
    expect(() => soqlTime("24:00:00Z")).toThrow(
      "SOQL time literals contain an invalid time.",
    );
  });

  it.each([
    "7:30:45Z",
    "07:30Z",
    "07:30:45.1Z",
    "07:30:45.12Z",
    "07:30:45.1234Z",
    "24:00:00Z",
    "07:60:00Z",
    "07:30:60Z",
    "07:30:45+10:00",
    "07:30:45",
    "07:30:45z",
  ])("rejects invalid time literals: %s", (value) => {
    expect(() => soqlTime(value)).toThrow(TypeError);
  });
});

describe("isSoqlTemporalLiteral", () => {
  it("recognizes all valid temporal literal kinds", () => {
    expect(isSoqlTemporalLiteral(soqlDate("2026-09-17"))).toBe(true);
    expect(isSoqlTemporalLiteral(soqlDateTime("2026-09-17T16:26:30Z"))).toBe(
      true,
    );
    expect(isSoqlTemporalLiteral(soqlTime("16:26:30Z"))).toBe(true);
  });

  it.each([null, undefined, true, 123, "2026-09-17"])(
    "rejects non-object candidates: %j",
    (value) => {
      expect(isSoqlTemporalLiteral(value)).toBe(false);
    },
  );

  it("rejects objects without a string value", () => {
    expect(isSoqlTemporalLiteral({ kind: "SoqlDateLiteral" })).toBe(false);
    expect(
      isSoqlTemporalLiteral({ kind: "SoqlDateLiteral", value: 20260917 }),
    ).toBe(false);
  });

  it("rejects unknown literal kinds", () => {
    expect(
      isSoqlTemporalLiteral({ kind: "UnknownLiteral", value: "2026-09-17" }),
    ).toBe(false);
  });

  it("revalidates forged wrappers instead of trusting their kind", () => {
    expect(
      isSoqlTemporalLiteral({
        kind: "SoqlDateLiteral",
        value: "2026-02-30",
      }),
    ).toBe(false);
    expect(
      isSoqlTemporalLiteral({
        kind: "SoqlDateTimeLiteral",
        value: "2026-09-17T24:00:00Z",
      }),
    ).toBe(false);
    expect(
      isSoqlTemporalLiteral({
        kind: "SoqlTimeLiteral",
        value: "24:00:00Z",
      }),
    ).toBe(false);
  });
});
