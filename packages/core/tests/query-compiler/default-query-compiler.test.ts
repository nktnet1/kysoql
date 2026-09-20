import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { SalesforceField, SalesforceObject } from "#/schema";
import { soqlRelativeDate } from "#/soql-relative-date-literal";
import { soqlDate, soqlDateTime, soqlTime } from "#/soql-temporal-literal";
import type { Simplify } from "#/util/type-utils";

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
    readonly CloseDate: SalesforceField<string, "date", true, true, true, true>;
    readonly LastActivityAt__c: SalesforceField<
      string,
      "datetime",
      true,
      true,
      true,
      true
    >;
    readonly OpeningTime__c: SalesforceField<
      string,
      "time",
      true,
      true,
      true,
      true
    >;
    readonly Industry: SalesforceField<
      string,
      "picklist",
      true,
      true,
      true,
      true,
      never,
      never,
      "Technology" | "Energy"
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

  it("compiles bounded FIELDS selections and leaves STANDARD unbounded", () => {
    const standard = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .selectFields("standard")
      .compile();
    const all = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .selectFields("all")
      .limit(200)
      .compile();

    expect(standard.soql).toBe("SELECT FIELDS(STANDARD) FROM Account");
    expect(all.soql).toBe("SELECT FIELDS(ALL) FROM Account LIMIT 200");
  });

  it("rejects unbounded ALL and CUSTOM field groups", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(() =>
      db.selectFrom("Account").selectFields("custom").compile(),
    ).toThrow("SOQL FIELDS(ALL) and FIELDS(CUSTOM) require LIMIT 200 or less.");
    expect(() =>
      db.selectFrom("Account").selectFields("all").limit(201).compile(),
    ).toThrow("SOQL FIELDS(ALL) and FIELDS(CUSTOM) require LIMIT 200 or less.");
  });

  it("compiles aliased toLabel selections in builder order", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Industry")
      .select(({ fn }) => fn.toLabel("Industry").as("industryLabel"))
      .select("Id")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Industry, toLabel(Industry) industryLabel, Id FROM Account",
    );
  });

  it("compiles aliased convertCurrency selections in builder order", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("AnnualRevenue")
      .select(({ fn }) =>
        fn.convertCurrency("AnnualRevenue").as("convertedRevenue"),
      )
      .select("Id")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT AnnualRevenue, convertCurrency(AnnualRevenue) convertedRevenue, Id FROM Account",
    );
  });

  it("compiles direct and converted FORMAT selections in builder order", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .select(({ fn }) => [
        fn.format("CloseDate").as("formattedCloseDate"),
        fn
          .format(fn.convertCurrency("AnnualRevenue"))
          .as("formattedConvertedRevenue"),
      ])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, FORMAT(CloseDate) formattedCloseDate, FORMAT(convertCurrency(AnnualRevenue)) formattedConvertedRevenue FROM Account",
    );
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

  it("compiles grouped OR filters before top-level AND filters", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where((eb) =>
        eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
      )
      .where("Name", "!=", null)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE (Name = 'Acme' OR AnnualRevenue >= 100000) AND Name != null",
    );
  });

  it("compiles nested AND and OR expression groups", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where((eb) =>
        eb.and([
          eb("Name", "!=", null),
          eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
        ]),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name != null AND (Name = 'Acme' OR AnnualRevenue >= 100000)",
    );
  });

  it("compiles logical NOT with grouped predicates", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where((eb) =>
        eb.not(
          eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
        ),
      )
      .where("Name", "!=", null)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE NOT (Name = 'Acme' OR AnnualRevenue >= 100000) AND Name != null",
    );
  });

  it("compiles additive ORDER BY fields with direction and null placement", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "like", "Acme%")
      .orderBy("Name", "asc", "first")
      .orderBy("Id", "desc", "last")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' ORDER BY Name ASC NULLS FIRST, Id DESC NULLS LAST",
    );
  });

  it("compiles null placement without an explicit direction", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Name")
      .orderBy("Name", undefined, "last")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Name FROM Account ORDER BY Name NULLS LAST",
    );
  });

  it("compiles LIMIT after WHERE and ORDER BY regardless of call order", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .limit(25)
      .where("Name", "like", "Acme%")
      .orderBy("Name", "asc")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' ORDER BY Name ASC LIMIT 25",
    );
  });

  it("compiles LIMIT 0 and only the latest chained limit", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .limit(100)
      .limit(0)
      .compile();

    expect(compiled.soql).toBe("SELECT Id FROM Account LIMIT 0");
  });

  it("compiles OFFSET after LIMIT and only the latest chained offset", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .offset(100)
      .limit(25)
      .offset(10)
      .compile();

    expect(compiled.soql).toBe("SELECT Id FROM Account LIMIT 25 OFFSET 10");
  });

  it("compiles OFFSET 0 without requiring LIMIT", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .offset(0)
      .compile();

    expect(compiled.soql).toBe("SELECT Id FROM Account OFFSET 0");
  });

  it("uses Salesforce's default ascending order when direction is omitted", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .orderBy("Name")
      .compile();

    expect(compiled.soql).toBe("SELECT Id FROM Account ORDER BY Name");
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

  it("compiles explicit temporal literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlDate("2026-09-17"))
      .where(
        "LastActivityAt__c",
        ">=",
        soqlDateTime("2026-09-17T16:26:30.125+10:00"),
      )
      .where("OpeningTime__c", "<", soqlTime("17:30:00.000Z"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = 2026-09-17 AND LastActivityAt__c >= 2026-09-17T16:26:30.125+10:00 AND OpeningTime__c < 17:30:00.000Z",
    );
  });

  it("compiles typed date functions in WHERE with timezone conversion", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where((eb) =>
        eb.and([
          eb(eb.fn.calendarYear("CloseDate"), "=", 2026),
          eb(
            eb.fn.dayOnly(eb.fn.convertTimezone("LastActivityAt__c")),
            ">=",
            soqlDate("2026-09-20"),
          ),
        ]),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CALENDAR_YEAR(CloseDate) = 2026 AND DAY_ONLY(convertTimezone(LastActivityAt__c)) >= 2026-09-20",
    );
  });

  it("compiles translated picklist filters with toLabel in WHERE", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where((eb) =>
        eb.and([
          eb(eb.fn.toLabel("Industry"), "=", "Technologie"),
          eb(eb.fn.toLabel("Industry"), "like", "Tech%"),
        ]),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE toLabel(Industry) = 'Technologie' AND toLabel(Industry) LIKE 'Tech%'",
    );
  });

  it("compiles fixed relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("TODAY"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("YESTERDAY"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = TODAY AND LastActivityAt__c >= YESTERDAY",
    );
  });

  it("compiles fixed month relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_MONTH"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("THIS_MONTH"))
      .where("CloseDate", "<", soqlRelativeDate("NEXT_MONTH"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_MONTH AND LastActivityAt__c >= THIS_MONTH AND CloseDate < NEXT_MONTH",
    );
  });

  it("compiles fixed quarter relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_QUARTER"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("THIS_QUARTER"))
      .where("CloseDate", "<", soqlRelativeDate("NEXT_QUARTER"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_QUARTER AND LastActivityAt__c >= THIS_QUARTER AND CloseDate < NEXT_QUARTER",
    );
  });

  it("compiles fixed year relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_YEAR"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("THIS_YEAR"))
      .where("CloseDate", "<", soqlRelativeDate("NEXT_YEAR"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_YEAR AND LastActivityAt__c >= THIS_YEAR AND CloseDate < NEXT_YEAR",
    );
  });

  it("compiles fixed fiscal year relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_FISCAL_YEAR"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("THIS_FISCAL_YEAR"))
      .where("CloseDate", "<", soqlRelativeDate("NEXT_FISCAL_YEAR"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_FISCAL_YEAR AND LastActivityAt__c >= THIS_FISCAL_YEAR AND CloseDate < NEXT_FISCAL_YEAR",
    );
  });

  it("compiles fixed fiscal quarter relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_FISCAL_QUARTER"))
      .where("LastActivityAt__c", ">=", soqlRelativeDate("THIS_FISCAL_QUARTER"))
      .where("CloseDate", "<", soqlRelativeDate("NEXT_FISCAL_QUARTER"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_FISCAL_QUARTER AND LastActivityAt__c >= THIS_FISCAL_QUARTER AND CloseDate < NEXT_FISCAL_QUARTER",
    );
  });

  it("compiles parameterized day relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_N_DAYS", 30))
      .where("LastActivityAt__c", "<", soqlRelativeDate("NEXT_N_DAYS", 7))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_N_DAYS:30 AND LastActivityAt__c < NEXT_N_DAYS:7",
    );
  });

  it("compiles parameterized month relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_N_MONTHS", 12))
      .where("LastActivityAt__c", "<", soqlRelativeDate("NEXT_N_MONTHS", 3))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_N_MONTHS:12 AND LastActivityAt__c < NEXT_N_MONTHS:3",
    );
  });

  it("compiles parameterized fiscal quarter relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_N_FISCAL_QUARTERS", 4))
      .where(
        "LastActivityAt__c",
        "<",
        soqlRelativeDate("NEXT_N_FISCAL_QUARTERS", 2),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_N_FISCAL_QUARTERS:4 AND LastActivityAt__c < NEXT_N_FISCAL_QUARTERS:2",
    );
  });

  it("compiles parameterized fiscal year relative date literals without quotes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlRelativeDate("LAST_N_FISCAL_YEARS", 3))
      .where(
        "LastActivityAt__c",
        "<",
        soqlRelativeDate("NEXT_N_FISCAL_YEARS", 2),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate = LAST_N_FISCAL_YEARS:3 AND LastActivityAt__c < NEXT_N_FISCAL_YEARS:2",
    );
  });

  it.each([
    "LAST_WEEK",
    "THIS_WEEK",
    "NEXT_WEEK",
    "LAST_90_DAYS",
    "NEXT_90_DAYS",
  ] as const)(
    "compiles remaining fixed relative date literal %s without quotes",
    (value) => {
      const compiled = new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id")
        .where("CloseDate", "=", soqlRelativeDate(value))
        .compile();

      expect(compiled.soql).toBe(
        `SELECT Id FROM Account WHERE CloseDate = ${value}`,
      );
    },
  );

  it.each([
    ["N_DAYS_AGO", 25],
    ["LAST_N_WEEKS", 52],
    ["NEXT_N_WEEKS", 4],
    ["N_WEEKS_AGO", 3],
    ["N_MONTHS_AGO", 6],
    ["LAST_N_QUARTERS", 2],
    ["NEXT_N_QUARTERS", 2],
    ["N_QUARTERS_AGO", 3],
    ["LAST_N_YEARS", 5],
    ["NEXT_N_YEARS", 5],
    ["N_YEARS_AGO", 2],
    ["N_FISCAL_QUARTERS_AGO", 6],
    ["N_FISCAL_YEARS_AGO", 3],
  ] as const)(
    "compiles remaining parameterized relative date literal %s:%d without quotes",
    (family, count) => {
      const compiled = new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id")
        .where("CloseDate", "=", soqlRelativeDate(family, count))
        .compile();

      expect(compiled.soql).toBe(
        `SELECT Id FROM Account WHERE CloseDate = ${family}:${count}`,
      );
    },
  );

  it("does not accept forged temporal wrappers as raw SOQL", () => {
    const forgedDate = {
      kind: "SoqlDateLiteral",
      value: "2026-09-17 OR Name != null",
    } as unknown as ReturnType<typeof soqlDate>;

    expect(() =>
      new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id")
        .where("CloseDate", "=", forgedDate)
        .compile(),
    ).toThrow("Unsupported SOQL literal type: object");
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
    expect(() =>
      new Kysoql<FixtureSchema>().selectFrom("Account").compile(),
    ).toThrow("Cannot compile a SELECT query without selections.");

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

    expectTypeOf<Simplify<OutputOfCompiled<typeof compiled>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });
});
