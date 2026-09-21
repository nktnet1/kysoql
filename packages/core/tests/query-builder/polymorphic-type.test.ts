import { describe, expect, expectTypeOf, it } from "vitest";

import { apexBind } from "#/apex-bind";
import { Kysoql } from "#/kysoql";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type PolymorphicReferenceField<
  Targets extends string,
  Relationship extends string,
  Nullable extends boolean,
> = SalesforceField<
  string,
  "reference",
  Nullable,
  true,
  true,
  true,
  Targets,
  Relationship,
  never,
  false,
  false,
  true
>;

type ReferenceField<
  Targets extends string,
  Relationship extends string,
  Nullable extends boolean,
> = SalesforceField<
  string,
  "reference",
  Nullable,
  true,
  true,
  true,
  Targets,
  Relationship
>;

type NamedObject = SalesforceObject<{
  readonly Id: SalesforceField<string, "id", false, true, true, true>;
  readonly Name: SalesforceField<string, "string", false, true, true, true>;
}>;

interface PolymorphicTypeSchema {
  readonly Event: SalesforceObject<
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
      readonly WhatId: PolymorphicReferenceField<
        "Account" | "Campaign" | "Opportunity",
        "What",
        true
      >;
      readonly RequiredWhoId: PolymorphicReferenceField<
        "Contact" | "Lead",
        "RequiredWho",
        false
      >;
      readonly ExternalWhatId: PolymorphicReferenceField<
        "Account" | "MissingTarget__c",
        "ExternalWhat",
        true
      >;
      readonly OwnerId: ReferenceField<"Calendar" | "User", "Owner", false>;
    },
    {
      readonly What: SalesforceParentRelationship<
        "Account" | "Campaign" | "Opportunity",
        "WhatId",
        true
      >;
      readonly RequiredWho: SalesforceParentRelationship<
        "Contact" | "Lead",
        "RequiredWhoId",
        false
      >;
      readonly ExternalWhat: SalesforceParentRelationship<
        "Account" | "MissingTarget__c",
        "ExternalWhatId",
        true
      >;
      readonly Owner: SalesforceParentRelationship<
        "Calendar" | "User",
        "OwnerId",
        false
      >;
    }
  >;
  readonly EventEnvelope__c: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Event__c: ReferenceField<"Event", "Event__r", true>;
    },
    {
      readonly Event__r: SalesforceParentRelationship<
        "Event",
        "Event__c",
        true
      >;
    }
  >;
  readonly Account: NamedObject;
  readonly Campaign: NamedObject;
  readonly Opportunity: NamedObject;
  readonly Contact: NamedObject;
  readonly Lead: NamedObject;
  readonly Calendar: NamedObject;
  readonly User: NamedObject;
}

type OutputOf<Query> =
  Query extends SelectQueryBuilder<infer _DB, infer _TB, infer Output>
    ? Output
    : never;

describe("polymorphic relationship Type qualifiers", () => {
  it("selects and filters the generated polymorphic Type qualifier", () => {
    const query = new Kysoql<PolymorphicTypeSchema>()
      .selectFrom("Event")
      .select(["Id", "What.Type", "What.Name"])
      .where("What.Type", "in", ["Account", "Opportunity"])
      .where((eb) => eb("What.Type", "like", "Opp%"));

    expect(query.compile().soql).toBe(
      "SELECT Id, What.Type, What.Name FROM Event WHERE What.Type IN ('Account', 'Opportunity') AND What.Type LIKE 'Opp%'",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly What: {
        readonly Type: "Account" | "Campaign" | "Opportunity";
        readonly Name: string;
      } | null;
    }>();
  });

  it("supports Type qualifiers through parent paths", () => {
    const query = new Kysoql<PolymorphicTypeSchema>()
      .selectFrom("EventEnvelope__c")
      .select(["Id", "Event__r.What.Type"])
      .where("Event__r.What.Type", "=", "Campaign");

    expect(query.compile().soql).toBe(
      "SELECT Id, Event__r.What.Type FROM EventEnvelope__c WHERE Event__r.What.Type = 'Campaign'",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Event__r: {
        readonly What: {
          readonly Type: "Account" | "Campaign" | "Opportunity";
        } | null;
      } | null;
    }>();
  });

  it("does not require every polymorphic target object to be generated", () => {
    const query = new Kysoql<PolymorphicTypeSchema>()
      .selectFrom("Event")
      .select("ExternalWhat.Type")
      .where("ExternalWhat.Type", "=", "MissingTarget__c");

    expect(query.compile().soql).toBe(
      "SELECT ExternalWhat.Type FROM Event WHERE ExternalWhat.Type = 'MissingTarget__c'",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly ExternalWhat: {
        readonly Type: "Account" | "MissingTarget__c";
      } | null;
    }>();
  });

  it("combines TYPEOF selection with a Type qualifier filter", () => {
    const query = new Kysoql<PolymorphicTypeSchema>()
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]).when("Opportunity", ["Name"]),
      )
      .where("What.Type", "in", ["Account", "Opportunity"]);

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF What WHEN Account THEN Name WHEN Opportunity THEN Name END FROM Event WHERE What.Type IN ('Account', 'Opportunity')",
    );
  });

  it("keeps polymorphic Type LIKE binds string-typed in Apex", () => {
    const query = new Kysoql<PolymorphicTypeSchema>()
      .selectFrom("Event")
      .select("Id")
      .apex()
      .where("What.Type", "like", apexBind<string>("typePattern"));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Event WHERE What.Type LIKE :typePattern",
    );
  });

  it("keeps target names and relationship capabilities type-safe", () => {
    const db = new Kysoql<PolymorphicTypeSchema>();
    const base = db.selectFrom("Event").select("Id");
    const invalidCalls = () => {
      // @ts-expect-error Contact is not a generated target of Event.What.
      base.where("What.Type", "=", "Contact");
      // @ts-expect-error Every IN member must be a generated Event.What target.
      base.where("What.Type", "in", ["Account", "Contact"]);
      // @ts-expect-error RequiredWho is non-nullable, so its Type qualifier cannot be null.
      base.where("RequiredWho.Type", "=", null);
      // @ts-expect-error Owner has multiple targets but is not generated as a polymorphic relationship.
      base.where("Owner.Type", "=", "User");
      // @ts-expect-error Owner.Type is not a selectable polymorphic Type qualifier.
      base.select("Owner.Type");
      // @ts-expect-error The Type qualifier is deliberately not exposed as sortable.
      base.orderBy("What.Type");
      const aggregate = db
        .selectFrom("Event")
        .select(({ fn }) => fn.count("Id").as("rowCount"));
      // @ts-expect-error The Type qualifier is deliberately not exposed as groupable.
      aggregate.groupBy("What.Type");
      db.selectFrom("Event").select(
        // @ts-expect-error The Type qualifier is deliberately not exposed as aggregatable.
        ({ fn }) => fn.count("What.Type").as("typeCount"),
      );
    };

    expect(invalidCalls).toBeTypeOf("function");

    expect(base.where("What.Type", "=", null).compile().soql).toBe(
      "SELECT Id FROM Event WHERE What.Type = null",
    );
    expect(base.where("What.Type", ">", "Account").compile().soql).toBe(
      "SELECT Id FROM Event WHERE What.Type > 'Account'",
    );
    expect(base.where("What.Type", "like", "Acc%").compile().soql).toBe(
      "SELECT Id FROM Event WHERE What.Type LIKE 'Acc%'",
    );
  });
});
