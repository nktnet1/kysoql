import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import { soqlRelativeDate } from "#/soql-relative-date-literal";
import { soqlDate, soqlDateTime, soqlTime } from "#/soql-temporal-literal";

/**
 * Representative semantic conformance matrix for the SOQL surface Kysoql exposes.
 *
 * These tests intentionally assert exact SOQL instead of only AST shape. They are
 * grounded in Salesforce's SOQL reference and protect the boundary where
 * Kysely-inspired builder ergonomics must still compile to Salesforce-native
 * syntax and restrictions.
 *
 * Reference pages:
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-dateformats.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-limits.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-rollup.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-typeof.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-for-update.html
 * - https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html
 */

type Field<
  Value,
  SalesforceType extends string,
  Nullable extends boolean = false,
  Aggregatable extends boolean = false,
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
  Aggregatable
>;

type ReferenceField<
  Target extends string,
  Relationship extends string,
  Nullable extends boolean = false,
  Polymorphic extends boolean = false,
> = SalesforceField<
  string,
  "reference",
  Nullable,
  true,
  true,
  true,
  Target,
  Relationship,
  never,
  false,
  false,
  Polymorphic
>;

interface ConformanceSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: Field<string, "id", false, true>;
      readonly Name: Field<string, "string", true>;
      readonly AnnualRevenue: Field<number, "currency", true, true>;
      readonly Active__c: Field<boolean, "boolean">;
      readonly CloseDate__c: Field<string, "date", true>;
      readonly LastActivityAt__c: Field<string, "datetime", true>;
      readonly OpeningTime__c: Field<string, "time", true>;
      readonly OwnerId: ReferenceField<"User", "Owner", true>;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
    },
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly Contact: SalesforceObject<
    {
      readonly Id: Field<string, "id", false, true>;
      readonly AccountId: ReferenceField<"Account", "Account", true>;
      readonly LastName: Field<string, "string">;
      readonly CreatedDate: Field<string, "datetime">;
    },
    {
      readonly Account: SalesforceParentRelationship<
        "Account",
        "AccountId",
        true
      >;
    }
  >;
  readonly Opportunity: SalesforceObject<{
    readonly Id: Field<string, "id", false, true>;
    readonly AccountId: ReferenceField<"Account", "Account", true>;
    readonly Name: Field<string, "string">;
    readonly StageName: SalesforceField<
      "Prospecting" | "Closed Won",
      "picklist",
      false,
      true,
      true,
      true,
      never,
      never,
      "Prospecting" | "Closed Won"
    >;
    readonly Amount: Field<number, "currency", true, true>;
    readonly CloseDate: Field<string, "date">;
  }>;
  readonly User: SalesforceObject<{
    readonly Id: Field<string, "id", false, true>;
    readonly Name: Field<string, "string">;
  }>;
  readonly Event: SalesforceObject<
    {
      readonly Id: Field<string, "id", false, true>;
      readonly WhatId: ReferenceField<
        "Account" | "Opportunity",
        "What",
        true,
        true
      >;
    },
    {
      readonly What: SalesforceParentRelationship<
        "Account" | "Opportunity",
        "WhatId",
        true
      >;
    }
  >;
  readonly EventLog__b: SalesforceObject<{
    readonly Account__c: Field<string, "string">;
    readonly Kind__c: Field<string, "string">;
    readonly CreatedAt__c: Field<string, "datetime">;
    readonly Payload__c: Field<string, "string">;
  }>;
}

const db = new Kysoql<ConformanceSchema>();

describe("SOQL semantic conformance", () => {
  it("keeps ordinary Kysely-style aliases client-side instead of emitting invalid record aliases", () => {
    const query = db
      .selectFrom("Account")
      .select(["Id as id", "Name as name", "Owner.Name as ownerName"]);

    expect(query.compile().soql).toBe(
      "SELECT Id, Name, Owner.Name FROM Account",
    );
  });

  it("renders scalar, temporal, and relative-date literals using SOQL syntax", () => {
    const query = db
      .selectFrom("Account")
      .select("Id")
      .where("Name", "=", "Bob's \\ BBQ\n")
      .where("Active__c", "=", true)
      .where("AnnualRevenue", ">=", 12.5)
      .where("CloseDate__c", "=", soqlDate("2026-09-25"))
      .where(
        "LastActivityAt__c",
        ">=",
        soqlDateTime("2026-09-25T08:30:00+10:00"),
      )
      .where("OpeningTime__c", "<", soqlTime("17:30:00.000Z"))
      .where("CloseDate__c", ">=", soqlRelativeDate("LAST_N_DAYS", 30));

    expect(query.compile().soql).toBe(
      String.raw`SELECT Id FROM Account WHERE Name = 'Bob\'s \\ BBQ\n' AND Active__c = TRUE AND AnnualRevenue >= 12.5 AND CloseDate__c = 2026-09-25 AND LastActivityAt__c >= 2026-09-25T08:30:00+10:00 AND OpeningTime__c < 17:30:00.000Z AND CloseDate__c >= LAST_N_DAYS:30`,
    );
  });

  it("uses Salesforce relationship paths and relationship-name child subqueries", () => {
    const query = db
      .selectFrom("Account")
      .select(["Id", "Owner.Name"])
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id as contactId", "LastName"])
          .where("LastName", "like", "A%")
          .orderBy("LastName")
          .limit(5),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, Owner.Name, (SELECT Id, LastName FROM Contacts WHERE LastName LIKE 'A%' ORDER BY LastName LIMIT 5) FROM Account",
    );
  });

  it("renders semi-joins and anti-joins and enforces Salesforce's two-subquery limit", () => {
    const first = db
      .selectFrom("Account")
      .select("Id")
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .select("AccountId")
          .where("StageName", "=", "Closed Won"),
      );
    const second = first.where("Id", "not in", (subquery) =>
      subquery
        .selectFrom("Contact")
        .select("AccountId")
        .where("LastName", "like", "Test%"),
    );

    expect(second.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won') AND Id NOT IN (SELECT AccountId FROM Contact WHERE LastName LIKE 'Test%')",
    );
    expect(() =>
      second.where("Id", "in", (subquery) =>
        subquery.selectFrom("Opportunity").select("AccountId"),
      ),
    ).toThrow(
      "SOQL WHERE clauses support at most two semi-join or anti-join subqueries.",
    );
  });

  it("emits native aliases only in grouped SOQL and preserves HAVING clause order", () => {
    const query = db
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.count("Id").as("rowCount"),
        fn.sum("AnnualRevenue").as("totalRevenue"),
      ])
      .groupBy(["Name", "Owner.Name"])
      .select(["Name as accountName", "Owner.Name as ownerName"])
      .having((eb) => eb(eb.fn.count("Id"), ">", 1))
      .orderBy("Name")
      .limit(25);

    expect(query.compile().soql).toBe(
      "SELECT COUNT(Id) rowCount, SUM(AnnualRevenue) totalRevenue, Name accountName, Owner.Name ownerName FROM Account GROUP BY Name, Owner.Name HAVING COUNT(Id) > 1 ORDER BY Name LIMIT 25",
    );
  });

  it("emits ROLLUP and enforces Salesforce's three-field subtotal limit", () => {
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));
    const rollup = aggregate
      .groupByRollup(["Name", "Active__c", "Owner.Name"])
      .select(["Name", "Active__c", "Owner.Name"]);

    expect(rollup.compile().soql).toBe(
      "SELECT COUNT(Id) rowCount, Name, Active__c, Owner.Name FROM Account GROUP BY ROLLUP(Name, Active__c, Owner.Name)",
    );
    expect(() =>
      aggregate
        .groupByRollup(["Name", "Active__c", "Owner.Name"])
        .groupByRollup("Id" as never),
    ).toThrow("SOQL GROUP BY ROLLUP can include at most three fields.");
  });

  it("renders polymorphic TYPEOF using Salesforce branch syntax", () => {
    const query = db
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) =>
        typeOf
          .when("Account", ["Name"])
          .when("Opportunity", ["Name", "Amount"]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF What WHEN Account THEN Name WHEN Opportunity THEN Name, Amount END FROM Event",
    );
  });

  it("preserves SOQL ORDER BY defaults and enforces the OFFSET 2000 ceiling", () => {
    const query = db
      .selectFrom("Account")
      .select(["Id", "Name"])
      .orderBy("Name", "desc", "last")
      .orderBy("Id")
      .limit(25)
      .offset(2000);

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account ORDER BY Name DESC NULLS LAST, Id LIMIT 25 OFFSET 2000",
    );
    expect(() => db.selectFrom("Account").select("Id").offset(2001)).toThrow(
      "SOQL OFFSET must be a safe integer between 0 and 2000.",
    );
  });

  it("keeps relationship-subquery OFFSET behind Salesforce's LIMIT 1 pilot rule", () => {
    const valid = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName"])
          .orderBy("LastName")
          .limit(10)
          .pilot.offset(5),
      )
      .limit(1);
    const invalid = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").pilot.offset(1),
      );

    expect(valid.compile().soql).toBe(
      "SELECT Id, (SELECT Id, LastName FROM Contacts ORDER BY LastName LIMIT 10 OFFSET 5) FROM Account LIMIT 1",
    );
    expect(() => invalid.compile()).toThrow(
      "SOQL relationship-subquery OFFSET pilot requires the immediate parent query to use a literal LIMIT 1.",
    );
  });

  it("keeps FOR UPDATE Apex-only and rejects the documented ORDER BY combination", () => {
    const locked = db
      .selectFrom("Account")
      .select("Id")
      .where("Name", "=", "Acme")
      .limit(1)
      .apex()
      .forUpdate();
    const invalid = db
      .selectFrom("Account")
      .select("Id")
      .orderBy("Name")
      .apex()
      .forUpdate();

    expect(locked.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = 'Acme' LIMIT 1 FOR UPDATE",
    );
    expect(() => invalid.compile()).toThrow(
      "SOQL FOR UPDATE cannot be combined with ORDER BY.",
    );
  });

  it("keeps bare COUNT() scalar semantics distinct from grouped aggregate queries", () => {
    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .limit(10);

    expect(count.compile().soql).toBe("SELECT COUNT() FROM Account LIMIT 10");
    expect(() =>
      db
        .selectFrom("Account")
        .orderBy("Name")
        .select(({ fn }) => fn.count()),
    ).toThrow("SOQL COUNT() queries cannot use ORDER BY or OFFSET.");
  });

  it("validates Big Object index order while rendering datetime index values unquoted", () => {
    const bigObjectDb = new Kysoql<ConformanceSchema>({
      schemaMetadata: {
        bigObjectIndexes: {
          EventLog__b: ["Account__c", "Kind__c", "CreatedAt__c"],
        },
      },
    });
    const base = bigObjectDb.selectFrom("EventLog__b").select("Payload__c");
    const query = base
      .where("Account__c", "=", "001xx000003DGbYAAW")
      .where("Kind__c", "=", "audit")
      .where("CreatedAt__c", ">=", soqlDateTime("2026-01-01T00:00:00Z"))
      .where("CreatedAt__c", "<", soqlDateTime("2027-01-01T00:00:00Z"));

    expect(query.compile().soql).toBe(
      "SELECT Payload__c FROM EventLog__b WHERE Account__c = '001xx000003DGbYAAW' AND Kind__c = 'audit' AND CreatedAt__c >= 2026-01-01T00:00:00Z AND CreatedAt__c < 2027-01-01T00:00:00Z",
    );
    expect(() => base.where("Kind__c", "=", "audit").compile()).toThrow(
      "SOQL big object WHERE clauses must use a leading, gap-free prefix of the configured index; preceding index fields require =, and the final field supports only =, <, >, <=, >=, or IN.",
    );
    expect(() =>
      base.where("Account__c", "!=", "001xx000003DGbYAAW").compile(),
    ).toThrow(
      "SOQL big object WHERE clauses must use a leading, gap-free prefix of the configured index; preceding index fields require =, and the final field supports only =, <, >, <=, >=, or IN.",
    );
  });
});
