import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceQueryResult,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type Field<
  Value,
  SalesforceType extends string,
  Nullable extends boolean = false,
  Aggregatable extends boolean = false,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
> = SalesforceField<
  Value,
  SalesforceType,
  Nullable,
  true,
  true,
  true,
  ReferenceTo,
  RelationshipName,
  never,
  Aggregatable
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: Field<string, "id", false, true>;
      readonly Name: Field<string, "string", true, true>;
      readonly AnnualRevenue: Field<number, "currency", true, true>;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly Contact: SalesforceObject<{
    readonly Id: Field<string, "id", false, true>;
    readonly LastName: Field<string, "string", false, true>;
    readonly AccountId: Field<
      string,
      "reference",
      true,
      true,
      "Account",
      "Account"
    >;
  }>;
}

type OutputOf<Query> = Query extends {
  compile(): CompiledQuery<infer Output>;
}
  ? Output
  : never;

describe("Kysely-style clear clause helpers", () => {
  it("clears root ORDER BY, LIMIT, and OFFSET immutably", () => {
    const db = new Kysoql<FixtureSchema>();
    const original = db
      .selectFrom("Account")
      .select("Id")
      .orderBy("Name", "desc")
      .limit(25)
      .offset(10);

    const cleared = original.clearOrderBy().clearLimit().clearOffset();

    expect(original.compile().soql).toBe(
      "SELECT Id FROM Account ORDER BY Name DESC LIMIT 25 OFFSET 10",
    );
    expect(cleared.compile().soql).toBe("SELECT Id FROM Account");
  });

  it("clearSelect resets root selections and inferred output", () => {
    const db = new Kysoql<FixtureSchema>();
    const original = db.selectFrom("Account").select(["Id", "Name"]);
    const cleared = original.clearSelect().select("AnnualRevenue");

    expect(original.compile().soql).toBe("SELECT Id, Name FROM Account");
    expect(cleared.compile().soql).toBe("SELECT AnnualRevenue FROM Account");
    expectTypeOf<Simplify<OutputOf<typeof cleared>>>().toEqualTypeOf<{
      readonly AnnualRevenue: number | null;
    }>();
  });

  it("clears relationship-subquery selection, ordering, and limit", () => {
    const db = new Kysoql<FixtureSchema>();

    const query = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName"])
          .orderBy("LastName")
          .limit(5)
          .clearSelect()
          .clearOrderBy()
          .clearLimit()
          .select("Id"),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts) FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
      }>;
    }>();
  });

  it("clears aggregate selections, ordering, limit, and grouping safely", () => {
    const db = new Kysoql<FixtureSchema>();
    const original = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .groupBy("Name")
      .select("Name")
      .orderBy("Name")
      .limit(10)
      .offset(2);

    const cleared = original
      .clearSelect()
      .clearOrderBy()
      .clearLimit()
      .clearOffset()
      .clearGroupBy()
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    expect(original.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue, Name FROM Account GROUP BY Name ORDER BY Name LIMIT 10 OFFSET 2",
    );
    expect(cleared.compile().soql).toBe(
      "SELECT COUNT(Id) rowCount FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof cleared>>>().toEqualTypeOf<{
      readonly rowCount: number;
    }>();
  });

  it("resets aggregate group type-state after clearGroupBy", () => {
    const db = new Kysoql<FixtureSchema>();
    const cleared = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByRollup("Name")
      .clearGroupBy();

    expect(cleared.compile().soql).toBe(
      "SELECT COUNT(Id) rowCount FROM Account",
    );

    function typecheckOnly(): void {
      // @ts-expect-error Aggregate LIMIT requires GROUP BY after the grouping was cleared.
      cleared.limit(10);

      cleared.groupBy("Name").limit(10);
    }

    void typecheckOnly;
  });

  it("rejects clearGroupBy when grouping-dependent clauses or selections remain", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    expect(() =>
      aggregate.groupBy("Name").select("Name").clearGroupBy(),
    ).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped field selections remain.",
    );

    expect(() =>
      aggregate.groupBy("Name").orderBy("Name").clearGroupBy(),
    ).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, LIMIT, or OFFSET clauses remain.",
    );

    expect(() => aggregate.groupBy("Name").limit(5).clearGroupBy()).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, LIMIT, or OFFSET clauses remain.",
    );

    expect(() => aggregate.groupBy("Name").offset(1).clearGroupBy()).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, LIMIT, or OFFSET clauses remain.",
    );

    expect(() =>
      aggregate
        .groupBy("Name")
        .having((eb) => eb(eb.fn.count("Id"), ">", 0))
        .clearGroupBy(),
    ).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, LIMIT, or OFFSET clauses remain.",
    );

    expect(() =>
      aggregate
        .groupByRollup("Name")
        .select(({ fn }) => fn.grouping("Name").as("groupedName"))
        .clearGroupBy(),
    ).toThrow(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouping-dependent selections remain.",
    );
  });

  it("treats clearGroupBy as a no-op when no grouping exists", () => {
    const db = new Kysoql<FixtureSchema>();

    const query = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .apex()
      .limit(10)
      .clearGroupBy();

    expect(query.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account LIMIT 10",
    );
  });

  it("clears COUNT() limits in API and Apex modes", () => {
    const db = new Kysoql<FixtureSchema>();

    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .limit(10)
      .clearLimit();
    expect(count.compile().soql).toBe("SELECT COUNT() FROM Account");

    const apexCount = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .limit(10)
      .clearLimit()
      .allRows();
    expect(apexCount.compile().soql).toBe(
      "SELECT COUNT() FROM Account ALL ROWS",
    );
  });

  it("clears inherited ORDER BY and Apex pagination without leaving Apex mode", () => {
    const db = new Kysoql<FixtureSchema>();

    const record = db
      .selectFrom("Account")
      .select("Id")
      .orderBy("Name")
      .limit(25)
      .offset(5)
      .apex()
      .clearOrderBy()
      .clearLimit()
      .clearOffset()
      .forUpdate();

    expect(record.compile().soql).toBe("SELECT Id FROM Account FOR UPDATE");

    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .groupBy("Name")
      .orderBy("Name")
      .limit(10)
      .apex()
      .offset(2)
      .clearOrderBy()
      .clearLimit()
      .clearOffset()
      .clearGroupBy()
      .withUserMode();

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WITH USER_MODE",
    );
  });
});
