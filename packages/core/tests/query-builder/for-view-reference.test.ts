import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#/schema";

type Field<Value = string, Type extends string = "string"> = SalesforceField<
  Value,
  Type,
  false,
  true,
  true,
  true,
  never,
  never,
  never,
  true
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Name: Field;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    },
    "mine",
    Record<string, never>,
    true
  >;
  readonly Contact: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
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
    never,
    Record<string, never>,
    true
  >;
  readonly NonMru__c: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
    },
    Record<string, never>,
    Record<string, never>,
    never,
    Record<string, never>,
    false
  >;
  readonly UnknownMru__c: SalesforceObject<{
    readonly Id: Field<string, "id">;
  }>;
}

describe("FOR VIEW and FOR REFERENCE", () => {
  it("compiles after OFFSET regardless of builder call order", () => {
    const db = new Kysoql<FixtureSchema>();
    const viewed = db
      .selectFrom("Account")
      .forView()
      .select(["Id", "Name"])
      .offset(5)
      .where("Name", "like", "Acme%")
      .usingScope("mine")
      .orderBy("Name", "asc")
      .limit(20);
    const referenced = db
      .selectFrom("Account")
      .select("Id")
      .forReference()
      .limit(1);

    expect(viewed.compile().soql).toBe(
      "SELECT Id, Name FROM Account USING SCOPE mine WHERE Name LIKE 'Acme%' ORDER BY Name ASC LIMIT 20 OFFSET 5 FOR VIEW",
    );
    expect(referenced.compile().soql).toBe(
      "SELECT Id FROM Account LIMIT 1 FOR REFERENCE",
    );
  });

  it("replaces the previous tracking mode immutably", () => {
    const base = new Kysoql<FixtureSchema>().selectFrom("Account").select("Id");
    const viewed = base.forView();
    const referenced = viewed.forReference();

    expect(base.toOperationNode().forViewReference).toBeUndefined();
    expect(viewed.toOperationNode().forViewReference).toEqual({
      kind: "ForViewReferenceNode",
      mode: "view",
    });
    expect(referenced.toOperationNode().forViewReference).toEqual({
      kind: "ForViewReferenceNode",
      mode: "reference",
    });
    expect(viewed.compile().soql).toBe("SELECT Id FROM Account FOR VIEW");
    expect(referenced.compile().soql).toBe(
      "SELECT Id FROM Account FOR REFERENCE",
    );
    expect(Object.isFrozen(referenced.toOperationNode().forViewReference)).toBe(
      true,
    );
  });

  it("retains the root clause across aggregate and scalar COUNT builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("accountCount"))
      .forView();
    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .forReference()
      .limit(10);

    expect(aggregate.compile().soql).toBe(
      "SELECT COUNT(Id) accountCount FROM Account FOR VIEW",
    );
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM Account LIMIT 10 FOR REFERENCE",
    );
  });

  it("uses Describe MRU metadata to gate unsupported objects while preserving unknown schemas", () => {
    const db = new Kysoql<FixtureSchema>();

    void (() => {
      db.selectFrom("Account").forView();
      db.selectFrom("UnknownMru__c").forReference();

      // @ts-expect-error Describe reports that this object is not MRU-enabled.
      db.selectFrom("NonMru__c").forView();
      // @ts-expect-error Describe reports that this object is not MRU-enabled.
      db.selectFrom("NonMru__c").forReference();
    });
  });

  it("keeps recent-usage clauses out of relationship subqueries", () => {
    new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) => {
        void (() => {
          // @ts-expect-error FOR VIEW is a root SELECT clause.
          contacts.forView();
          // @ts-expect-error FOR REFERENCE is a root SELECT clause.
          contacts.forReference();
        });

        return contacts.select("Id");
      });
  });
});
