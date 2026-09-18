import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isSoqlRelativeDateLiteral,
  soqlRelativeDate,
  type SoqlRelativeDateFamily,
  type SoqlRelativeDateValue,
} from "#/soql-relative-date-literal";

type ExpectedRelativeDateFamily =
  | "LAST_N_DAYS"
  | "NEXT_N_DAYS"
  | "N_DAYS_AGO"
  | "LAST_N_WEEKS"
  | "NEXT_N_WEEKS"
  | "N_WEEKS_AGO"
  | "LAST_N_MONTHS"
  | "NEXT_N_MONTHS"
  | "N_MONTHS_AGO"
  | "LAST_N_QUARTERS"
  | "NEXT_N_QUARTERS"
  | "N_QUARTERS_AGO"
  | "LAST_N_YEARS"
  | "NEXT_N_YEARS"
  | "N_YEARS_AGO"
  | "LAST_N_FISCAL_QUARTERS"
  | "NEXT_N_FISCAL_QUARTERS"
  | "N_FISCAL_QUARTERS_AGO"
  | "LAST_N_FISCAL_YEARS"
  | "NEXT_N_FISCAL_YEARS"
  | "N_FISCAL_YEARS_AGO";

type ExpectedFixedRelativeDateValue =
  | "TODAY"
  | "YESTERDAY"
  | "TOMORROW"
  | "LAST_WEEK"
  | "THIS_WEEK"
  | "NEXT_WEEK"
  | "LAST_MONTH"
  | "THIS_MONTH"
  | "NEXT_MONTH"
  | "LAST_90_DAYS"
  | "NEXT_90_DAYS"
  | "LAST_QUARTER"
  | "THIS_QUARTER"
  | "NEXT_QUARTER"
  | "LAST_YEAR"
  | "THIS_YEAR"
  | "NEXT_YEAR"
  | "LAST_FISCAL_YEAR"
  | "THIS_FISCAL_YEAR"
  | "NEXT_FISCAL_YEAR"
  | "LAST_FISCAL_QUARTER"
  | "THIS_FISCAL_QUARTER"
  | "NEXT_FISCAL_QUARTER";

type ExpectedRelativeDateValue =
  | ExpectedFixedRelativeDateValue
  | `${ExpectedRelativeDateFamily}:${number}`;

describe("SOQL relative date literals", () => {
  it.each([
    "TODAY",
    "YESTERDAY",
    "TOMORROW",
    "LAST_WEEK",
    "THIS_WEEK",
    "NEXT_WEEK",
    "LAST_MONTH",
    "THIS_MONTH",
    "NEXT_MONTH",
    "LAST_90_DAYS",
    "NEXT_90_DAYS",
    "LAST_QUARTER",
    "THIS_QUARTER",
    "NEXT_QUARTER",
    "LAST_YEAR",
    "THIS_YEAR",
    "NEXT_YEAR",
    "LAST_FISCAL_YEAR",
    "THIS_FISCAL_YEAR",
    "NEXT_FISCAL_YEAR",
    "LAST_FISCAL_QUARTER",
    "THIS_FISCAL_QUARTER",
    "NEXT_FISCAL_QUARTER",
  ] as const)("creates a frozen %s literal", (value) => {
    const literal = soqlRelativeDate(value);

    expect(literal).toEqual({
      kind: "SoqlRelativeDateLiteral",
      value,
    });
    expect(Object.isFrozen(literal)).toBe(true);
    expect(isSoqlRelativeDateLiteral(literal)).toBe(true);
  });

  it.each([
    ["LAST_N_DAYS", 5, "LAST_N_DAYS:5"],
    ["NEXT_N_DAYS", 0, "NEXT_N_DAYS:0"],
    ["N_DAYS_AGO", 25, "N_DAYS_AGO:25"],
    ["LAST_N_WEEKS", 52, "LAST_N_WEEKS:52"],
    ["NEXT_N_WEEKS", 4, "NEXT_N_WEEKS:4"],
    ["N_WEEKS_AGO", 3, "N_WEEKS_AGO:3"],
    ["LAST_N_MONTHS", 12, "LAST_N_MONTHS:12"],
    ["NEXT_N_MONTHS", 1, "NEXT_N_MONTHS:1"],
    ["N_MONTHS_AGO", 6, "N_MONTHS_AGO:6"],
    ["LAST_N_QUARTERS", 2, "LAST_N_QUARTERS:2"],
    ["NEXT_N_QUARTERS", 2, "NEXT_N_QUARTERS:2"],
    ["N_QUARTERS_AGO", 3, "N_QUARTERS_AGO:3"],
    ["LAST_N_YEARS", 5, "LAST_N_YEARS:5"],
    ["NEXT_N_YEARS", 5, "NEXT_N_YEARS:5"],
    ["N_YEARS_AGO", 2, "N_YEARS_AGO:2"],
    ["LAST_N_FISCAL_QUARTERS", 4, "LAST_N_FISCAL_QUARTERS:4"],
    ["NEXT_N_FISCAL_QUARTERS", 0, "NEXT_N_FISCAL_QUARTERS:0"],
    ["N_FISCAL_QUARTERS_AGO", 6, "N_FISCAL_QUARTERS_AGO:6"],
    ["LAST_N_FISCAL_YEARS", 3, "LAST_N_FISCAL_YEARS:3"],
    ["NEXT_N_FISCAL_YEARS", 0, "NEXT_N_FISCAL_YEARS:0"],
    ["N_FISCAL_YEARS_AGO", 3, "N_FISCAL_YEARS_AGO:3"],
  ] as const)("creates a frozen %s:%d literal", (family, count, value) => {
    const literal = soqlRelativeDate(family, count);

    expect(literal).toEqual({
      kind: "SoqlRelativeDateLiteral",
      value,
    });
    expect(Object.isFrozen(literal)).toBe(true);
    expect(isSoqlRelativeDateLiteral(literal)).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects invalid parameterized counts: %s",
    (count) => {
      expect(() => soqlRelativeDate("LAST_N_DAYS", count)).toThrow(
        "SOQL relative date count must be a non-negative safe integer.",
      );
      expect(() => soqlRelativeDate("N_WEEKS_AGO", count)).toThrow(
        "SOQL relative date count must be a non-negative safe integer.",
      );
      expect(() => soqlRelativeDate("LAST_N_FISCAL_YEARS", count)).toThrow(
        "SOQL relative date count must be a non-negative safe integer.",
      );
    },
  );

  it("rejects unsupported relative date inputs at runtime", () => {
    expect(() => soqlRelativeDate("LAST_N_DAYS:5" as "TODAY")).toThrow(
      "SOQL fixed relative date literal must be one of:",
    );
    expect(() =>
      soqlRelativeDate("LAST_N_HOURS" as SoqlRelativeDateFamily, 5),
    ).toThrow("SOQL relative date family must be one of:");
  });

  it.each([
    "LAST_N_DAYS:5",
    "NEXT_N_MONTHS:0",
    "LAST_N_YEARS:5",
    "N_FISCAL_QUARTERS_AGO:6",
    "N_FISCAL_YEARS_AGO:3",
  ])("revalidates a forged valid wrapper value %s", (value) => {
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value,
      }),
    ).toBe(true);
  });

  it.each([
    "LAST_N_DAYS:-1",
    "NEXT_N_DAYS:1.5",
    "LAST_N_WEEKS:01",
    "LAST_N_HOURS:5",
    `N_YEARS_AGO:${Number.MAX_SAFE_INTEGER + 1}`,
    "N_YEARS_AGO:1:2",
  ])("rejects a forged invalid wrapper value %s", (value) => {
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value,
      }),
    ).toBe(false);
  });

  it("exposes all documented fixed values and parameterized families", () => {
    expectTypeOf<SoqlRelativeDateFamily>().toEqualTypeOf<
      ExpectedRelativeDateFamily
    >();
    expectTypeOf<SoqlRelativeDateValue>().toEqualTypeOf<
      ExpectedRelativeDateValue
    >();

    function typecheckOnly(): void {
      // @ts-expect-error Parameterized relative dates require the family/count API.
      soqlRelativeDate("LAST_N_DAYS:5");
      // @ts-expect-error Parameterized relative date families require a count.
      soqlRelativeDate("LAST_N_DAYS");
      // @ts-expect-error Unsupported families are not accepted.
      soqlRelativeDate("LAST_N_HOURS", 5);
      // @ts-expect-error Fixed literals do not take a count.
      soqlRelativeDate("TODAY", 5);
    }

    void typecheckOnly;
  });
});
