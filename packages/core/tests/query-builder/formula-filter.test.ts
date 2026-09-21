import { describe, expect, it } from "vitest";

import { apexBind } from "#/apex-bind";
import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import { soqlDate, soqlDateTime } from "#/soql-temporal-literal";

type Field<
  Value,
  SalesforceType extends string,
  Filterable extends boolean = true,
> = SalesforceField<
  Value,
  SalesforceType,
  true,
  Filterable,
  true,
  true
>;

interface FormulaSchema {
  readonly Order__c: SalesforceObject<{
    readonly Id: SalesforceField<
      string,
      "id",
      false,
      true,
      true,
      true,
      never,
      never,
      never,
      true
    >;
    readonly Revenue__c: Field<number, "currency">;
    readonly Cost__c: Field<number, "currency">;
    readonly Score__c: Field<number, "double">;
    readonly Units__c: Field<number, "int">;
    readonly OrderDate__c: Field<string, "date">;
    readonly ShipDate__c: Field<string, "date">;
    readonly CreatedAt__c: Field<string, "datetime">;
    readonly UpdatedAt__c: Field<string, "datetime">;
    readonly MarginPercent__c: Field<number, "percent">;
    readonly Name: Field<string, "string">;
    readonly InternalScore__c: Field<number, "double", false>;
  }>;
}

describe("FORMULA() WHERE filters", () => {
  it("compiles structured numeric and temporal arithmetic", () => {
    const db = new Kysoql<FormulaSchema>();

    expect(
      db
        .selectFrom("Order__c")
        .select("Id")
        .where((eb) =>
          eb(eb.beta.formula("Revenue__c", "-", "Cost__c"), ">", 250),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('Revenue__c - Cost__c') > 250",
    );

    expect(
      db
        .selectFrom("Order__c")
        .select("Id")
        .where((eb) =>
          eb(eb.beta.formula("ShipDate__c", "-", "OrderDate__c"), ">", 3),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('ShipDate__c - OrderDate__c') > 3",
    );

    expect(
      db
        .selectFrom("Order__c")
        .select("Id")
        .where((eb) =>
          eb(
            eb.beta.formula("OrderDate__c", "+", "Units__c"),
            ">=",
            soqlDate("2026-09-21"),
          ),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('OrderDate__c + Units__c') >= 2026-09-21",
    );

    expect(
      db
        .selectFrom("Order__c")
        .select("Id")
        .where((eb) =>
          eb(
            eb.beta.formula("CreatedAt__c", "+", "Units__c"),
            "<",
            soqlDateTime("2026-09-22T00:00:00Z"),
          ),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('CreatedAt__c + Units__c') < 2026-09-22T00:00:00Z",
    );
  });

  it("keeps structured FORMULA() available in Apex WHERE and accepts typed binds", () => {
    const compiled = new Kysoql<FormulaSchema>()
      .selectFrom("Order__c")
      .select("Id")
      .apex()
      .where((eb) =>
        eb(
          eb.beta.formula("Revenue__c", "-", "Cost__c"),
          ">",
          apexBind<number>("minimumProfit"),
        ),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('Revenue__c - Cost__c') > :minimumProfit",
    );

    expect(
      new Kysoql<FormulaSchema>()
        .selectFrom("Order__c")
        .select("Id")
        .dynamicApex()
        .where((eb) =>
          eb(
            eb.beta.formula("OrderDate__c", "+", "Units__c"),
            ">=",
            apexBind<string>("minimumDate"),
          ),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Order__c WHERE FORMULA('OrderDate__c + Units__c') >= :minimumDate",
    );
  });

  it("supports documented numeric-family combinations", () => {
    const query = new Kysoql<FormulaSchema>().selectFrom("Order__c").select("Id");

    query.where((eb) => eb(eb.beta.formula("Score__c", "+", "Units__c"), "=", 10));
    query.where((eb) =>
      eb(eb.beta.formula("Revenue__c", "-", "Score__c"), ">=", 100),
    );
    query.where((eb) =>
      eb(eb.beta.formula("UpdatedAt__c", "-", "CreatedAt__c"), "<=", 7),
    );
  });

  it("keeps beta FORMULA() on WHERE expression builders only", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FormulaSchema>();
      const query = db.selectFrom("Order__c").select("Id");

      query.select((eb) => {
        // @ts-expect-error FORMULA() is documented only for WHERE, not SELECT.
        eb.beta.formula("Revenue__c", "-", "Cost__c");
        return eb.fn.format("Score__c").as("formattedScore");
      });

      db.selectFrom("Order__c")
        .select(({ fn }) => fn.count("Id").as("rowCount"))
        .groupBy("Units__c")
        .having((eb) => {
          // @ts-expect-error FORMULA() is documented only for WHERE, not HAVING.
          eb.beta.formula("Revenue__c", "-", "Cost__c");
          return eb(eb.fn.count("Id"), ">", 1);
        });
    };

    expect(typeAssertions).toBeTypeOf("function");
  });

  it("rejects unsupported fields, arithmetic pairs, and comparison values", () => {
    const typeAssertions = () => {
      const query = new Kysoql<FormulaSchema>()
        .selectFrom("Order__c")
        .select("Id");

      query.where((eb) => {
        // @ts-expect-error FORMULA() supports only documented numeric/date/currency field families.
        eb.beta.formula("Name", "-", "Cost__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error Percent fields are not listed as FORMULA() operands by Salesforce.
        eb.beta.formula("MarginPercent__c", "-", "Cost__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error FORMULA() operands must retain generated filterable metadata.
        eb.beta.formula("InternalScore__c", "+", "Units__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error A non-date left operand cannot use a date right operand.
        eb.beta.formula("Revenue__c", "-", "OrderDate__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error DATE and DATETIME operands cannot be mixed.
        eb.beta.formula("OrderDate__c", "-", "CreatedAt__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error Adding two date fields is not valid date arithmetic; date differences use subtraction.
        eb.beta.formula("ShipDate__c", "+", "OrderDate__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        // @ts-expect-error FORMULA() exposes only + and - arithmetic.
        eb.beta.formula("Revenue__c", "*", "Cost__c");
        return eb("Id", "!=", "");
      });

      query.where((eb) => {
        const formula = eb.beta.formula("Revenue__c", "-", "Cost__c");
        // @ts-expect-error Numeric FORMULA() results require numeric comparison literals.
        return eb(formula, ">", soqlDate("2026-09-21"));
      });

      query.where((eb) => {
        const formula = eb.beta.formula("OrderDate__c", "+", "Units__c");
        // @ts-expect-error Date-valued FORMULA() results require SOQL date literals.
        return eb(formula, "=", 1);
      });

      query.where((eb) => {
        const formula = eb.beta.formula("CreatedAt__c", "+", "Units__c");
        // @ts-expect-error Datetime-valued FORMULA() results require SOQL datetime literals.
        return eb(formula, "=", soqlDate("2026-09-21"));
      });

      query.where((eb) => {
        const formula = eb.beta.formula("Revenue__c", "-", "Cost__c");
        // @ts-expect-error FORMULA() comparisons are scalar equality/ordered comparisons, not IN lists.
        return eb(formula, "in", [100, 200]);
      });
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
