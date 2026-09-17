import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "../kysoql.js";
import type { SalesforceField, SalesforceObject } from "../schema.js";
import type { Simplify } from "../util/type-utils.js";
import type { CompiledQuery } from "./compiled-query.js";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
    readonly AnnualRevenue: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true
    >;
  }>;
  readonly Kysoql_Record__c: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Active__c: SalesforceField<
      boolean,
      "boolean",
      false,
      true,
      true,
      true
    >;
  }>;
}

type OutputOfCompiled<Query> =
  Query extends CompiledQuery<infer Output> ? Output : never;

describe("DefaultQueryCompiler", () => {
  it("compiles selections in builder order", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Name", "Id", "AnnualRevenue"]);

    const compiled = query.compile();

    expect(compiled.soql).toBe("SELECT Name, Id, AnnualRevenue FROM Account");
    expect(compiled.query).toBe(query.toOperationNode());
    expect(Object.isFrozen(compiled)).toBe(true);
  });

  it("compiles chained filters and SOQL operator casing", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "like", "Acme%")
      .where("AnnualRevenue", ">=", 100_000)
      .where("AnnualRevenue", "!=", null)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' AND AnnualRevenue >= 100000 AND AnnualRevenue != null",
    );
  });

  it("escapes SOQL strings without changing LIKE wildcard escapes", () => {
    const escapedString = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Name", "=", "Bob's \\ BBQ\n")
      .compile();

    expect(escapedString.soql).toBe(
      String.raw`SELECT Id FROM Account WHERE Name = 'Bob\'s \\ BBQ\n'`,
    );

    const escapedLikeWildcard = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Name", "like", String.raw`Acme\%`)
      .compile();

    expect(escapedLikeWildcard.soql).toBe(
      String.raw`SELECT Id FROM Account WHERE Name LIKE 'Acme\%'`,
    );
  });

  it("compiles booleans using SOQL boolean literals", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Kysoql_Record__c")
      .select("Id")
      .where("Active__c", "=", true)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Kysoql_Record__c WHERE Active__c = TRUE",
    );
  });

  it("rejects queries without selections and non-finite numbers", () => {
    expect(() => new Kysoql<FixtureSchema>().selectFrom("Account").compile()).toThrow(
      "Cannot compile a SELECT query without selections.",
    );

    expect(() =>
      new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id")
        .where("AnnualRevenue", "=", Number.NaN)
        .compile(),
    ).toThrow("SOQL numeric literals must be finite numbers.");
  });

  it("preserves the selected result type on compiled queries", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .compile();

    expectTypeOf<
      Simplify<OutputOfCompiled<typeof compiled>>
    >().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });
});
