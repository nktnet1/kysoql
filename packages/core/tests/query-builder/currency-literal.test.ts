import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import {
  isSoqlCurrencyLiteral,
  soqlCurrency,
} from "#/soql-currency-literal";

type Field<
  Value,
  SalesforceType extends string,
  Nullable extends boolean = true,
> = SalesforceField<
  Value,
  SalesforceType,
  Nullable,
  true,
  true,
  true,
  never,
  never,
  never,
  true
>;

interface CurrencySchema {
  readonly Opportunity: SalesforceObject<{
    readonly Id: Field<string, "id", false>;
    readonly Name: Field<string, "string", false>;
    readonly Amount: Field<number, "currency">;
    readonly Probability: Field<number, "percent">;
  }>;
}

describe("SOQL currency literals", () => {
  it("creates frozen ISO-coded currency literals", () => {
    const literal = soqlCurrency("USD", 5000);

    expect(literal).toEqual({
      kind: "SoqlCurrencyLiteral",
      isoCode: "USD",
      value: 5000,
    });
    expect(Object.isFrozen(literal)).toBe(true);
    expect(isSoqlCurrencyLiteral(literal)).toBe(true);
  });

  it.each(["usd", "US", "USDD", "U$D", "123"])(
    "rejects invalid ISO code %s",
    (isoCode) => {
      expect(() => soqlCurrency(isoCode, 5000)).toThrow(
        "SOQL currency ISO code must use exactly three uppercase ASCII letters.",
      );
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid numeric value %s",
    (value) => {
      expect(() => soqlCurrency("USD", value)).toThrow(
        "SOQL currency literal value must be a finite number.",
      );
    },
  );

  it("revalidates forged currency wrappers", () => {
    expect(
      isSoqlCurrencyLiteral({
        kind: "SoqlCurrencyLiteral",
        isoCode: "EUR",
        value: 42.5,
      }),
    ).toBe(true);
    expect(
      isSoqlCurrencyLiteral({
        kind: "SoqlCurrencyLiteral",
        isoCode: "eur",
        value: 42.5,
      }),
    ).toBe(false);
    expect(
      isSoqlCurrencyLiteral({
        kind: "SoqlCurrencyLiteral",
        isoCode: "EUR",
        value: Number.NaN,
      }),
    ).toBe(false);
  });

  it("compiles currency literals in scalar and homogeneous set WHERE filters", () => {
    const query = new Kysoql<CurrencySchema>()
      .selectFrom("Opportunity")
      .select(["Id", "Amount"])
      .where("Amount", ">", soqlCurrency("USD", 5000))
      .where((eb) => eb("Amount", "!=", soqlCurrency("AUD", 7000)))
      .where("Amount", "in", [
        soqlCurrency("USD", 5000),
        soqlCurrency("EUR", 4500.5),
      ]);

    expect(query.compile().soql).toBe(
      "SELECT Id, Amount FROM Opportunity WHERE Amount > USD5000 AND Amount != AUD7000 AND Amount IN (USD5000, EUR4500.5)",
    );
  });

  it("preserves ordinary numeric currency filters", () => {
    const query = new Kysoql<CurrencySchema>()
      .selectFrom("Opportunity")
      .select("Id")
      .where("Amount", ">=", 5000)
      .where("Amount", "not in", [1000, 2000]);

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Opportunity WHERE Amount >= 5000 AND Amount NOT IN (1000, 2000)",
    );
  });

  it("rejects mixed ISO-coded and non-ISO IN lists at runtime", () => {
    const query = new Kysoql<CurrencySchema>()
      .selectFrom("Opportunity")
      .select("Id");

    expect(() =>
      query.where(
        "Amount",
        "in",
        [soqlCurrency("USD", 5000), 6000] as never,
      ),
    ).toThrow(
      "SOQL IN/NOT IN currency value lists cannot mix ISO-coded and non-ISO values.",
    );
  });

  it("restricts currency literals to currency WHERE operands at compile time", () => {
    function typecheckOnly(): void {
      const db = new Kysoql<CurrencySchema>();
      const literal = soqlCurrency("USD", 5000);

      db.selectFrom("Opportunity").where("Amount", "=", literal);
      db.selectFrom("Opportunity").where("Amount", "in", [literal]);

      // @ts-expect-error ISO-coded currency literals are only valid for currency fields.
      db.selectFrom("Opportunity").where("Probability", ">", literal);

      // @ts-expect-error Currency IN lists cannot mix ISO-coded and bare numeric values.
      db.selectFrom("Opportunity").where("Amount", "in", [literal, 6000]);
    }

    void typecheckOnly;
  });

  it("keeps ISO-coded currency literals out of HAVING at compile time", () => {
    function typecheckOnly(): void {
      const literal = soqlCurrency("USD", 5000);
      const grouped = new Kysoql<CurrencySchema>()
        .selectFrom("Opportunity")
        .select(({ fn }) => fn.max("Amount").as("maxAmount"))
        .groupBy("Amount");

      // @ts-expect-error Salesforce only supports ISO-coded currency literals in WHERE filters.
      grouped.having("Amount", ">", literal);

      grouped.having((eb) => {
        // @ts-expect-error Aggregate currency comparisons use ordinary numeric values.
        return eb(eb.fn.max("Amount"), ">", literal);
      });
    }

    void typecheckOnly;
  });
});
