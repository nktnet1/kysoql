import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isSoqlRelativeDateLiteral,
  soqlRelativeDate,
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

  it("rejects unsupported relative date values at runtime", () => {
    expect(() =>
      soqlRelativeDate("LAST_N_DAYS:5" as SoqlRelativeDateValue),
    ).toThrow(
      "SOQL relative date literals must be TODAY, YESTERDAY, or TOMORROW.",
    );
  });

  it("revalidates forged wrappers instead of trusting their kind", () => {
    expect(
      isSoqlRelativeDateLiteral({
        kind: "SoqlRelativeDateLiteral",
        value: "LAST_N_DAYS:5",
      }),
    ).toBe(false);
  });

  it("exposes only the supported fixed literal names", () => {
    expectTypeOf<SoqlRelativeDateValue>().toEqualTypeOf<
      "TODAY" | "YESTERDAY" | "TOMORROW"
    >();

    function typecheckOnly(): void {
      // @ts-expect-error Parameterized relative dates are a later slice.
      soqlRelativeDate("LAST_N_DAYS:5");
    }

    void typecheckOnly;
  });
});
