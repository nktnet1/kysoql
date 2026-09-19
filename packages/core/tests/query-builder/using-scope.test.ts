import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#/schema";

interface FixtureSchema {
  readonly Account: SalesforceObject<
    {
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
      readonly Name: SalesforceField<string, "string", true, true, true, true>;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    },
    "delegated" | "everything" | "mine" | "mine_and_my_groups" | "team"
  >;
  readonly Contact: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly AccountId: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "Account",
        "Account"
      >;
    },
    Record<string, never>,
    Record<string, never>,
    "everything" | "mine"
  >;
  readonly NoScope__c: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
  }>;
}

describe("USING SCOPE", () => {
  it("stores the selected scope immutably and replaces it on repeated calls", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const mineQuery = baseQuery.usingScope("mine");
    const teamQuery = mineQuery.usingScope("team");

    expect(baseQuery.toOperationNode().usingScope).toBeUndefined();
    expect(mineQuery.toOperationNode().usingScope).toEqual({
      kind: "UsingScopeNode",
      scope: "mine",
    });
    expect(teamQuery.toOperationNode().usingScope).toEqual({
      kind: "UsingScopeNode",
      scope: "team",
    });
    expect(Object.isFrozen(mineQuery.toOperationNode())).toBe(true);
    expect(Object.isFrozen(mineQuery.toOperationNode().usingScope)).toBe(true);
    expect(mineQuery.compile().soql).toBe(
      "SELECT Id FROM Account USING SCOPE mine",
    );
    expect(teamQuery.compile().soql).toBe(
      "SELECT Id FROM Account USING SCOPE team",
    );
  });

  it("compiles after FROM and before the remaining top-level clauses", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .usingScope("mine_and_my_groups")
      .where("Name", "like", "Acme%")
      .orderBy("Name", "desc")
      .limit(25)
      .offset(5);

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account USING SCOPE mine_and_my_groups WHERE Name LIKE 'Acme%' ORDER BY Name DESC LIMIT 25 OFFSET 5",
    );
  });

  it("remains available on root aggregate and COUNT() builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregateQuery = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("recordCount"))
      .usingScope("everything")
      .groupBy("Name")
      .select("Name")
      .where("Name", "like", "Acme%")
      .orderBy("Name")
      .limit(10);
    const countQuery = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .usingScope("delegated")
      .where("Name", "like", "Acme%")
      .limit(100);

    expect(aggregateQuery.compile().soql).toBe(
      "SELECT COUNT(Id) recordCount, Name FROM Account USING SCOPE everything WHERE Name LIKE 'Acme%' GROUP BY Name ORDER BY Name LIMIT 10",
    );
    expect(countQuery.compile().soql).toBe(
      "SELECT COUNT() FROM Account USING SCOPE delegated WHERE Name LIKE 'Acme%' LIMIT 100",
    );
  });

  it("restricts scopes to Describe-generated values and omits child-query support", () => {
    const db = new Kysoql<FixtureSchema>();
    const account = db.selectFrom("Account");
    const contact = db.selectFrom("Contact");
    const noScope = db.selectFrom("NoScope__c");

    void (() => {
      account.usingScope("mine");
      contact.usingScope("mine");

      // @ts-expect-error Scope names are object-specific Describe metadata.
      account.usingScope("territory");
      // @ts-expect-error Contact does not advertise the Account-only team scope.
      contact.usingScope("team");
      // @ts-expect-error Objects without supportedScopes expose no USING SCOPE values.
      noScope.usingScope("mine");
    });

    account.selectSubquery("Contacts", (contacts) => {
      void (() => {
        // @ts-expect-error Salesforce disallows USING SCOPE in relationship subqueries.
        contacts.usingScope("mine");
      });

      return contacts.select("Id");
    });
  });
});
