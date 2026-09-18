import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isSoqlRelativeDateLiteral,
  soqlRelativeDate,
  type SoqlRelativeDateFamily,
  type SoqlRelativeDateValue,
} from "#/soql-relative-date-literal";

describe("SOQL relative date literals", () => {
  it.each(["TODAY", "YESTERDAY", "TOMORROW"] as const)(
    "creates a frozen %s literal",
    (value) => {
      const literal = soqlRelativeDate(value);

      expect(literal).toEqual({
        kind: "SoqlRelativeDateLiteral",
        value,
      });
      expect(Object.isFrozen(literal)).toBe(true);
      expect(isSoqlRelativeDateLiteral(literal)).toBe(true);
    },
  );

  it.each([
    ["LAST_N_DAYS", 5, "LAST_N_DAYS:5"],
    ["NEXT_N_DAYS", 0, "NEXT_N_DAYS:0"],
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
    "rejects invalid parameterized day counts: %s",
    (count) => {
      expect(() => soqlRelativeDate("LAST_N_DAYS", count)).toThrow(
        "SOQL relative date count must be a non-negative safe integer.",
      );
    },
  );

  it("rejects unsupported relative date inputs at runtime", () => {
    expect(() =>
      soqlRelativeDate("LAST_N_DAYS:5" as "TODAY"),
    ).toThrow(
      "SOQL fixed relative date literals must be TODAY, YESTERDAY, or TOMORROW.",
    );
    expect(() =>
      soqlRelativeDate("LAST_N_MONTHS" as SoqlRelativeDateFamily, 5),
    ).toThrow(
      "SOQL relative date family must be LAST_N_DAYS or NEXT_N_DAYS.",
    );
  });

  it("revalidates forged wrappers instead of trusting their kind", () => {
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value: "LAST_N_DAYS:5",
      }),
    ).toBe(true);
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value: "LAST_N_DAYS:-1",
      }),
    ).toBe(false);
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value: "NEXT_N_DAYS:1.5",
      }),
    ).toBe(false);
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value: "LAST_N_MONTHS:5",
      }),
    ).toBe(false);
  });

  it("exposes fixed values plus the parameterized day family", () => {
    expectTypeOf<SoqlRelativeDateFamily>().toEqualTypeOf<
      "LAST_N_DAYS" | "NEXT_N_DAYS"
    >();
    expectTypeOf<SoqlRelativeDateValue>().toEqualTypeOf<
      | "TODAY"
      | "YESTERDAY"
      | "TOMORROW"
      | `LAST_N_DAYS:${number}`
      | `NEXT_N_DAYS:${number}`
    >();

    soqlRelativeDate("LAST_N_DAYS", 30);
    soqlRelativeDate("NEXT_N_DAYS", 30);

    function typecheckOnly(): void {
      // @ts-expect-error Parameterized relative dates require the family/count API.
      soqlRelativeDate("LAST_N_DAYS:5");
      // @ts-expect-error Parameterized relative date families require a count.
      soqlRelativeDate("LAST_N_DAYS");
      // @ts-expect-error Unsupported families are not accepted.
      soqlRelativeDate("LAST_N_MONTHS", 5);
      // @ts-expect-error Fixed literals do not take a count.
      soqlRelativeDate("TODAY", 5);
    }

    void typecheckOnly;
  });
});
