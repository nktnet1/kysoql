import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
  SalesforceRecordAttributes,
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

interface TypeOfSchema {
  readonly Event: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Subject: SalesforceField<
        string,
        "string",
        true,
        true,
        true,
        true
      >;
      readonly Status__c: SalesforceField<
        string,
        "picklist",
        true,
        true,
        true,
        true,
        never,
        never,
        "Open" | "Closed"
      >;
      readonly WhatId: PolymorphicReferenceField<
        "Account" | "Campaign" | "Opportunity",
        "What",
        true
      >;
      readonly WhoId: PolymorphicReferenceField<
        "Contact" | "Lead",
        "Who",
        true
      >;
      readonly OwnerId: SalesforceField<
        string,
        "reference",
        false,
        true,
        true,
        true,
        "Calendar" | "User",
        "Owner"
      >;
    },
    {
      readonly What: SalesforceParentRelationship<
        "Account" | "Campaign" | "Opportunity",
        "WhatId",
        true
      >;
      readonly Who: SalesforceParentRelationship<
        "Contact" | "Lead",
        "WhoId",
        true
      >;
      readonly Owner: SalesforceParentRelationship<
        "Calendar" | "User",
        "OwnerId",
        false
      >;
    },
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "EventId">;
    }
  >;
  readonly Account: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Name: SalesforceField<string, "string", false, true, true, true>;
      readonly Phone: SalesforceField<string, "phone", true, true, true, true>;
      readonly NumberOfEmployees: SalesforceField<
        number,
        "int",
        true,
        true,
        true,
        true
      >;
      readonly OwnerId: SalesforceField<
        string,
        "reference",
        false,
        true,
        true,
        true,
        "User",
        "Owner"
      >;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", false>;
    }
  >;
  readonly Opportunity: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
    readonly Amount: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true
    >;
    readonly CloseDate: SalesforceField<
      string,
      "date",
      false,
      true,
      true,
      true
    >;
  }>;
  readonly Campaign: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
  }>;
  readonly Contact: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
    readonly Email: SalesforceField<string, "email", true, true, true, true>;
    readonly Status__c: SalesforceField<
      string,
      "picklist",
      true,
      true,
      true,
      true,
      never,
      never,
      "Active" | "Inactive"
    >;
  }>;
  readonly Lead: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
    readonly Email: SalesforceField<string, "email", true, true, true, true>;
  }>;
  readonly User: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
  }>;
  readonly Calendar: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", false, true, true, true>;
  }>;
  readonly EventEnvelope__c: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Event__c: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "Event",
        "Event__r"
      >;
    },
    {
      readonly Event__r: SalesforceParentRelationship<
        "Event",
        "Event__c",
        true
      >;
    }
  >;
}

type OutputOf<Query> =
  Query extends SelectQueryBuilder<infer _DB, infer _TB, infer Output>
    ? Output
    : never;

type RuntimeEventSelectQueryBuilder = SelectQueryBuilder<
  TypeOfSchema,
  "Event",
  Record<never, never>,
  "plain"
>;

interface RuntimeTypeOfBuilder {
  when(object: string, selections: readonly string[]): RuntimeTypeOfBuilder;

  toOperationNode(): TypeOfNode;
}

const bypassSelectMode = (query: object): RuntimeEventSelectQueryBuilder =>
  query as RuntimeEventSelectQueryBuilder;

const bypassTypeOfConstraints = (builder: object): RuntimeTypeOfBuilder =>
  builder as RuntimeTypeOfBuilder;

type AccountWhat = {
  readonly attributes: SalesforceRecordAttributes<"Account">;
  readonly Phone: string | null;
  readonly NumberOfEmployees: number | null;
  readonly Owner: {
    readonly Name: string;
  };
};

type OpportunityWhat = {
  readonly attributes: SalesforceRecordAttributes<"Opportunity">;
  readonly Amount: number | null;
  readonly CloseDate: string;
};

type CampaignWhat = {
  readonly attributes: SalesforceRecordAttributes<"Campaign">;
  readonly Name: string;
};

describe("polymorphic TYPEOF selection", () => {
  it("builds immutable TYPEOF branches and infers a discriminated relationship union", () => {
    const base = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select(["Id", "Subject"]);
    const query = base.selectTypeOf("What", (typeOf) =>
      typeOf
        .when("Account", ["Phone", "NumberOfEmployees", "Owner.Name"])
        .when("Opportunity", ["Amount", "CloseDate"])
        .else(["Name"]),
    );

    expect(base.compile().soql).toBe("SELECT Id, Subject FROM Event");
    expect(query.compile().soql).toBe(
      "SELECT Id, Subject, TYPEOF What WHEN Account THEN Phone, NumberOfEmployees, Owner.Name WHEN Opportunity THEN Amount, CloseDate ELSE Name END FROM Event",
    );

    const node = query.toOperationNode().selections?.[2]?.selection;
    expect(node).toEqual({
      kind: "TypeOfNode",
      reference: { kind: "ReferenceNode", name: "What" },
      whens: [
        {
          kind: "TypeOfWhenNode",
          object: "Account",
          selections: [
            { kind: "ReferenceNode", name: "Phone" },
            { kind: "ReferenceNode", name: "NumberOfEmployees" },
            { kind: "ReferenceNode", name: "Owner.Name" },
          ],
        },
        {
          kind: "TypeOfWhenNode",
          object: "Opportunity",
          selections: [
            { kind: "ReferenceNode", name: "Amount" },
            { kind: "ReferenceNode", name: "CloseDate" },
          ],
        },
      ],
      elseSelections: [{ kind: "ReferenceNode", name: "Name" }],
    });
    expect(Object.isFrozen(node)).toBe(true);
    if (node?.kind === "TypeOfNode") {
      expect(Object.isFrozen(node.whens)).toBe(true);
      expect(Object.isFrozen(node.whens[0])).toBe(true);
      expect(Object.isFrozen(node.whens[0]?.selections)).toBe(true);
      expect(Object.isFrozen(node.elseSelections)).toBe(true);
    }

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Subject: string | null;
      readonly What: AccountWhat | OpportunityWhat | CampaignWhat | null;
    }>();
  });

  it("returns null for unmatched types when ELSE is omitted", () => {
    const query = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) => typeOf.when("Account", ["Phone"]));

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF What WHEN Account THEN Phone END FROM Event",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly What: {
        readonly attributes: SalesforceRecordAttributes<"Account">;
        readonly Phone: string | null;
      } | null;
    }>();
  });

  it("supports polymorphic targets reached through a parent relationship path", () => {
    const query = new Kysoql<TypeOfSchema>()
      .selectFrom("EventEnvelope__c")
      .select("Id")
      .selectTypeOf("Event__r.What", (typeOf) =>
        typeOf
          .when("Account", ["Name"])
          .when("Opportunity", ["Name"])
          .when("Campaign", ["Name"]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF Event__r.What WHEN Account THEN Name WHEN Opportunity THEN Name WHEN Campaign THEN Name END FROM EventEnvelope__c",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Event__r: {
        readonly What:
          | {
              readonly attributes: SalesforceRecordAttributes<"Account">;
              readonly Name: string;
            }
          | {
              readonly attributes: SalesforceRecordAttributes<"Opportunity">;
              readonly Name: string;
            }
          | {
              readonly attributes: SalesforceRecordAttributes<"Campaign">;
              readonly Name: string;
            }
          | null;
      } | null;
    }>();
  });

  it("keeps foreign-key IDs and sibling parent fields compatible with TYPEOF", () => {
    const direct = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select(["Id", "WhatId"])
      .selectTypeOf("What", (typeOf) => typeOf.when("Account", ["Name"]));

    expect(direct.compile().soql).toBe(
      "SELECT Id, WhatId, TYPEOF What WHEN Account THEN Name END FROM Event",
    );

    const parentPath = new Kysoql<TypeOfSchema>()
      .selectFrom("EventEnvelope__c")
      .select(["Id", "Event__r.Subject"])
      .selectTypeOf("Event__r.What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      );

    expect(parentPath.compile().soql).toBe(
      "SELECT Id, Event__r.Subject, TYPEOF Event__r.What WHEN Account THEN Name END FROM EventEnvelope__c",
    );
  });

  it("supports multiple independent TYPEOF selections", () => {
    const query = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) => typeOf.when("Account", ["Name"]))
      .selectTypeOf("Who", (typeOf) =>
        typeOf.when("Contact", ["Email"]).when("Lead", ["Email"]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF What WHEN Account THEN Name END, TYPEOF Who WHEN Contact THEN Email WHEN Lead THEN Email END FROM Event",
    );
  });

  it("keeps ordinary relationship subqueries available when they contain no SELECT functions", () => {
    const query = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) => typeOf.when("Account", ["Name"]))
      .selectSubquery("Contacts", (contacts) => contacts.select("Email"));

    expect(query.compile().soql).toBe(
      "SELECT Id, TYPEOF What WHEN Account THEN Name END, (SELECT Email FROM Contacts) FROM Event",
    );
  });

  it("rejects invalid TYPEOF combinations at compile time", () => {
    const db = new Kysoql<TypeOfSchema>();
    const base = db.selectFrom("Event").select("Id");
    const invalidCalls = () => {
      // @ts-expect-error TYPEOF targets relationship names, not foreign-key field names.
      base.selectTypeOf("WhatId", (typeOf) => typeOf.when("Account", ["Name"]));
      // @ts-expect-error Owner has multiple reference targets but is not generated as polymorphic.
      base.selectTypeOf("Owner", (typeOf) => typeOf.when("User", ["Name"]));
      base.selectTypeOf("What", (typeOf) =>
        // @ts-expect-error Contact is not a valid What target.
        typeOf.when("Contact", ["Name"]),
      );
      base.selectTypeOf("What", (typeOf) =>
        // @ts-expect-error Amount is not an Account field.
        typeOf.when("Account", ["Amount"]),
      );
      base.selectTypeOf("What", (typeOf) =>
        typeOf
          .when("Account", ["Name"])
          // @ts-expect-error Each WHEN object can appear only once.
          .when("Account", ["Name"]),
      );
      base.selectTypeOf("What", (typeOf) =>
        // @ts-expect-error TYPEOF WHEN requires a non-empty field list.
        typeOf.when("Account", []),
      );
      // @ts-expect-error TYPEOF requires at least one WHEN branch.
      base.selectTypeOf("What", (typeOf) => typeOf);
      base.selectTypeOf("What", (typeOf) =>
        typeOf
          .when("Account", ["Name"])
          .when("Opportunity", ["Name"])
          // @ts-expect-error The remaining Campaign branch does not have Phone.
          .else(["Phone"]),
      );
      base.selectTypeOf("What", (typeOf) =>
        typeOf
          .when("Account", ["Name"])
          // @ts-expect-error ELSE fields must be valid for every remaining generated target.
          .else(["Amount"]),
      );

      const typeOfQuery = base.selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      );
      typeOfQuery.select(
        // @ts-expect-error TYPEOF cannot be combined with SELECT functions.
        ({ fn }) => fn.toLabel("Status__c").as("status"),
      );
      // @ts-expect-error The TYPEOF relationship cannot also be selected through the ordinary field list.
      typeOfQuery.select("What.Name");

      const functionQuery = base.select(({ fn }) =>
        fn.toLabel("Status__c").as("status"),
      );
      // @ts-expect-error TYPEOF cannot be added after a SELECT function.
      functionQuery.selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      );

      const relationshipQuery = base.select("What.Name");
      // @ts-expect-error A relationship already used in the ordinary field list cannot become a TYPEOF target.
      relationshipQuery.selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      );

      typeOfQuery.selectSubquery("Contacts", (subquery) =>
        subquery.select(
          // @ts-expect-error TYPEOF cannot be combined with SELECT functions in relationship subqueries.
          ({ fn }) => fn.toLabel("Status__c").as("status"),
        ),
      );

      const subqueryFunctionQuery = base.selectSubquery(
        "Contacts",
        (subquery) =>
          subquery.select(({ fn }) => fn.toLabel("Status__c").as("status")),
      );
      // @ts-expect-error TYPEOF cannot be added after a SELECT function in a relationship subquery.
      subqueryFunctionQuery.selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      );

      typeOfQuery.select(
        // @ts-expect-error Aggregate mode cannot start after TYPEOF selection.
        ({ fn }) => fn.count("Id").as("count"),
      );
    };

    expect(invalidCalls).toBeTypeOf("function");
  });

  it("enforces TYPEOF runtime compatibility even through unsafe casts", () => {
    const base = new Kysoql<TypeOfSchema>().selectFrom("Event").select("Id");
    const typeOfQuery = base.selectTypeOf("What", (typeOf) =>
      typeOf.when("Account", ["Name"]),
    );

    expect(() =>
      bypassSelectMode(typeOfQuery).select(({ fn }) =>
        fn.toLabel("Status__c").as("status"),
      ),
    ).toThrow(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );

    const functionQuery = base.select(({ fn }) =>
      fn.toLabel("Status__c").as("status"),
    );
    expect(() =>
      bypassSelectMode(functionQuery).selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      ),
    ).toThrow(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );

    expect(() => bypassSelectMode(typeOfQuery).select("What.Name")).toThrow(
      "SOQL TYPEOF relationship What cannot also be referenced in the SELECT field list.",
    );

    expect(() =>
      base.selectTypeOf("What", (typeOf) =>
        bypassTypeOfConstraints(typeOf)
          .when("Account", ["Name"])
          .when("Account", ["Phone"]),
      ),
    ).toThrow("SOQL TYPEOF cannot contain duplicate WHEN object branches.");

    expect(() =>
      base.selectTypeOf("What", (typeOf) =>
        bypassTypeOfConstraints(typeOf).when("Account", []),
      ),
    ).toThrow("SOQL TYPEOF branches must select at least one field.");

    expect(() =>
      bypassSelectMode(typeOfQuery).selectSubquery("Contacts", (subquery) =>
        subquery.select(({ fn }) => fn.toLabel("Status__c").as("status")),
      ),
    ).toThrow(
      "SOQL TYPEOF cannot be combined with SELECT functions, GROUP BY, or HAVING.",
    );

    const subqueryFunctionQuery = base.selectSubquery("Contacts", (subquery) =>
      subquery.select(({ fn }) => fn.toLabel("Status__c").as("status")),
    );
    expect(() =>
      bypassSelectMode(subqueryFunctionQuery).selectTypeOf("What", (typeOf) =>
        typeOf.when("Account", ["Name"]),
      ),
    ).toThrow(
      "SOQL TYPEOF cannot be combined with SELECT functions, GROUP BY, or HAVING.",
    );
  });

  it("rejects TYPEOF with GROUP BY at the compiler boundary", () => {
    const typeOfQuery = new Kysoql<TypeOfSchema>()
      .selectFrom("Event")
      .select("Id")
      .selectTypeOf("What", (typeOf) => typeOf.when("Account", ["Name"]));
    const node = SelectQueryNode.cloneWithGroupByItems(
      typeOfQuery.toOperationNode(),
      [ReferenceNode.create("Id")],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(node)).toThrow(
      "SOQL TYPEOF cannot be combined with SELECT functions, GROUP BY, or HAVING.",
    );
  });
});
