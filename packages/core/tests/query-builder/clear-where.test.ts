import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#src/schema";

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

describe("clearWhere", () => {
  it("clears root WHERE clauses without mutating the original builder", () => {
    const db = new Kysoql<FixtureSchema>();
    const filtered = db
      .selectFrom("Account")
      .select("Id")
      .where("Name", "like", "Acme%")
      .where("AnnualRevenue", ">=", 100_000);

    const cleared = filtered.clearWhere().limit(5);

    expect(filtered.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name LIKE 'Acme%' AND AnnualRevenue >= 100000",
    );
    expect(cleared.compile().soql).toBe("SELECT Id FROM Account LIMIT 5");
  });

  it("preserves aggregate and count builder modes", () => {
    const db = new Kysoql<FixtureSchema>();

    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .where("Name", "like", "Acme%")
      .clearWhere()
      .where("AnnualRevenue", ">", 0);

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WHERE AnnualRevenue > 0",
    );

    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .where("Name", "like", "Acme%")
      .clearWhere()
      .limit(10);

    expect(count.compile().soql).toBe("SELECT COUNT() FROM Account LIMIT 10");
  });

  it("clears relationship-subquery and semi-join WHERE clauses", () => {
    const db = new Kysoql<FixtureSchema>();

    const relationship = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .where("LastName", "=", "Smith")
          .clearWhere()
          .orderBy("LastName"),
      );

    expect(relationship.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts ORDER BY LastName) FROM Account",
    );

    const semiJoin = db
      .selectFrom("Account")
      .select("Id")
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .where("StageName", "=", "Prospecting")
          .clearWhere()
          .select("AccountId")
          .where("StageName", "=", "Closed Won")
          .clearWhere(),
      );

    expect(semiJoin.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity)",
    );
  });

  it("clears Apex WHERE clauses while preserving Apex-only builder methods", () => {
    const db = new Kysoql<FixtureSchema>();

    const record = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", "Acme")
      .clearWhere()
      .forUpdate();

    expect(record.compile().soql).toBe("SELECT Id FROM Account FOR UPDATE");

    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("revenue"))
      .apex()
      .where("Name", "=", "Acme")
      .clearWhere()
      .withUserMode();

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) revenue FROM Account WITH USER_MODE",
    );

    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .where("Name", "=", "Acme")
      .clearWhere()
      .allRows();

    expect(count.compile().soql).toBe("SELECT COUNT() FROM Account ALL ROWS");

    const relationship = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .where("LastName", "=", "Smith")
          .clearWhere()
          .limit(5),
      );

    expect(relationship.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts LIMIT 5) FROM Account",
    );
  });
});
