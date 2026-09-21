import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
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
  readonly Opportunity: SalesforceObject<{
    readonly Id: Field<string, "id", false, true>;
    readonly AccountId: Field<
      string,
      "reference",
      true,
      true,
      "Account",
      "Account"
    >;
    readonly StageName: Field<string, "picklist", false, true>;
  }>;
}

type OutputOf<Query> = Query extends {
  execute(): Promise<readonly (infer Output)[]>;
}
  ? Output
  : never;

describe("$if", () => {
  it("runs the callback only when the condition is true", () => {
    const db = new Kysoql<FixtureSchema>();
    let falseCalls = 0;
    let trueCalls = 0;

    const skipped = db
      .selectFrom("Account")
      .select("Id")
      .$if(false, (qb) => {
        falseCalls += 1;
        return qb.where("Name", "like", "Acme%");
      });

    const applied = db
      .selectFrom("Account")
      .select("Id")
      .$if(true, (qb) => {
        trueCalls += 1;
        return qb.where("Name", "like", "Acme%").limit(5);
      });

    expect(falseCalls).toBe(0);
    expect(trueCalls).toBe(1);
    expect(skipped.compile().soql).toBe("SELECT Id FROM Account");
    expect(applied.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name LIKE 'Acme%' LIMIT 5",
    );
  });

  it("makes conditionally selected output fields optional", () => {
    const db = new Kysoql<FixtureSchema>();
    const includeName = false as boolean;
    const includeCount = false as boolean;

    const record = db
      .selectFrom("Account")
      .select("Id")
      .$if(includeName, (qb) => qb.select("Name"));

    expect(record.compile().soql).toBe("SELECT Id FROM Account");
    expectTypeOf<Simplify<OutputOf<typeof record>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name?: string | null;
    }>();

    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .$if(includeCount, (qb) =>
        qb.select(({ fn }) => fn.count("Id").as("rowCount")),
      );

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof aggregate>>>().toEqualTypeOf<{
      readonly revenue: number | null;
      readonly rowCount?: number;
    }>();

    const relationship = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .$if(includeName, (qb) => qb.select("LastName")),
      );

    expect(relationship.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts) FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof relationship>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
        readonly LastName?: string;
      }>;
    }>();
  });

  it("preserves specialised count, Apex, and semi-join builder modes", () => {
    const db = new Kysoql<FixtureSchema>();

    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .$if(true, (qb) => qb.where("Name", "like", "Acme%").limit(10));
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM Account WHERE Name LIKE 'Acme%' LIMIT 10",
    );

    const apexRecord = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .$if(true, (qb) => qb.where("Name", "=", "Acme").forUpdate());
    expect(apexRecord.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = 'Acme' FOR UPDATE",
    );

    const apexAggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .apex()
      .$if(true, (qb) => qb.withUserMode().limit(5));
    expect(apexAggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WITH USER_MODE LIMIT 5",
    );

    const apexCount = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .$if(true, (qb) => qb.withSystemMode().limit(5));
    expect(apexCount.compile().soql).toBe(
      "SELECT COUNT() FROM Account WITH SYSTEM_MODE LIMIT 5",
    );

    const semiJoin = db
      .selectFrom("Account")
      .select("Id")
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .$if(true, (qb) => qb.where("StageName", "=", "Closed Won"))
          .select("AccountId")
          .$if(true, (qb) => qb.where("StageName", "!=", "Prospecting")),
      );

    expect(semiJoin.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won' AND StageName != 'Prospecting')",
    );
  });

  it("does not make conditional structural mode transitions look unconditional", () => {
    const db = new Kysoql<FixtureSchema>();

    function typecheckOnly(): void {
      const record = db.selectFrom("Account");
      record.$if(true, (qb) =>
        // @ts-expect-error aggregate mode cannot be entered only on the true branch
        qb.select(({ fn }) => fn.sum("AnnualRevenue").as("revenue")),
      );

      const selected = db.selectFrom("Account").select("Id");
      selected.$if(true, (qb) =>
        // @ts-expect-error SELECT-function mode cannot be entered only on the true branch
        qb.select(({ fn }) => fn.format("AnnualRevenue").as("formatted")),
      );

      const aggregate = db
        .selectFrom("Account")
        .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"));
      // @ts-expect-error GROUP BY state cannot be introduced only on the true branch
      aggregate.$if(true, (qb) => qb.groupBy("Name"));
    }

    void typecheckOnly;
  });
});
