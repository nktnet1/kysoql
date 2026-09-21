import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#/schema";

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

describe("$call", () => {
  it("composes root record queries and returns the callback result", () => {
    const db = new Kysoql<FixtureSchema>();

    const query = db
      .selectFrom("Account")
      .$call((qb) => qb.select(["Id", "Name"]))
      .$call((qb) => qb.where("Name", "like", "Acme%"))
      .$call((qb) => qb.orderBy("Name", "asc").limit(5));

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' ORDER BY Name ASC LIMIT 5",
    );

    const sql = query.$call((qb) => qb.compile().soql);
    expectTypeOf(sql).toEqualTypeOf<string>();
    expect(sql).toBe(query.compile().soql);
  });

  it("preserves aggregate, count, and Apex builder modes", () => {
    const db = new Kysoql<FixtureSchema>();

    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .$call((qb) => qb.where("Name", "like", "Acme%").groupBy("Name"))
      .$call((qb) => qb.limit(10));

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WHERE Name LIKE 'Acme%' GROUP BY Name LIMIT 10",
    );

    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .$call((qb) => qb.where("Name", "like", "Acme%").limit(10));

    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM Account WHERE Name LIKE 'Acme%' LIMIT 10",
    );

    const apexRecord = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .$call((qb) => qb.where("Name", "=", "Acme").forUpdate());
    expect(apexRecord.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = 'Acme' FOR UPDATE",
    );

    const apexAggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .apex()
      .$call((qb) => qb.withUserMode().limit(5));
    expect(apexAggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WITH USER_MODE LIMIT 5",
    );

    const apexCount = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .$call((qb) => qb.withSystemMode().limit(5));
    expect(apexCount.compile().soql).toBe(
      "SELECT COUNT() FROM Account WITH SYSTEM_MODE LIMIT 5",
    );
  });

  it("composes relationship and semi-join subquery builders", () => {
    const db = new Kysoql<FixtureSchema>();

    const query = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (subquery) =>
        subquery
          .$call((qb) => qb.select(["Id", "LastName"]))
          .$call((qb) => qb.where("LastName", "like", "A%").limit(2)),
      )
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .$call((qb) => qb.where("StageName", "=", "Closed Won"))
          .select("AccountId")
          .$call((qb) => qb.where("StageName", "!=", "Prospecting")),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, LastName FROM Contacts WHERE LastName LIKE 'A%' LIMIT 2) FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won' AND StageName != 'Prospecting')",
    );
  });
});
