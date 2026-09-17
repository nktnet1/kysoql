import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "../kysoql.js";
import type { SalesforceField, SalesforceObject } from "../schema.js";
import type { Simplify } from "../util/type-utils.js";
import type { SelectQueryBuilder } from "./select-query-builder.js";

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
    readonly Internal_Note__c: SalesforceField<
      string,
      "string",
      true,
      false,
      false,
      false
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

type OutputOf<Query> =
  Query extends SelectQueryBuilder<infer _DB, infer _TB, infer Output>
    ? Output
    : never;

describe("SelectQueryBuilder", () => {
  it("creates immutable select query nodes", () => {
    const db = new Kysoql<FixtureSchema>();
    const baseQuery = db.selectFrom("Account");
    const selectedQuery = baseQuery.select(["Id", "Name"]);

    expect(baseQuery.toOperationNode()).toEqual({
      kind: "SelectQueryNode",
      from: {
        kind: "SObjectNode",
        name: "Account",
      },
    });
    expect(selectedQuery.toOperationNode()).toEqual({
      kind: "SelectQueryNode",
      from: {
        kind: "SObjectNode",
        name: "Account",
      },
      selections: [
        {
          kind: "SelectionNode",
          selection: { kind: "ReferenceNode", name: "Id" },
        },
        {
          kind: "SelectionNode",
          selection: { kind: "ReferenceNode", name: "Name" },
        },
      ],
    });

    expect(baseQuery.toOperationNode().selections).toBeUndefined();
    expect(Object.isFrozen(selectedQuery.toOperationNode())).toBe(true);
    expect(Object.isFrozen(selectedQuery.toOperationNode().selections)).toBe(
      true,
    );
  });

  it("accumulates selections without mutating the previous builder", () => {
    const db = new Kysoql<FixtureSchema>();
    const idQuery = db.selectFrom("Account").select("Id");
    const fullQuery = idQuery.select(["Name", "AnnualRevenue"]);

    expect(idQuery.toOperationNode().selections).toHaveLength(1);
    expect(fullQuery.toOperationNode().selections).toHaveLength(3);
  });

  it("infers the selected result shape", () => {
    const db = new Kysoql<FixtureSchema>();
    const query = db
      .selectFrom("Account")
      .select("Id")
      .select(["Name", "AnnualRevenue"]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
      readonly AnnualRevenue: number | null;
    }>();
  });

  it("adds typed where clauses without mutating earlier builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const baseQuery = db.selectFrom("Account").select(["Id", "Name"]);
    const nameQuery = baseQuery.where("Name", "=", "Acme");
    const filteredQuery = nameQuery.where("AnnualRevenue", "!=", null);

    expect(baseQuery.toOperationNode().where).toBeUndefined();
    expect(nameQuery.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Name" },
        operator: { kind: "OperatorNode", operator: "=" },
        rightOperand: { kind: "ValueNode", value: "Acme" },
      },
    });
    expect(filteredQuery.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "AndNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "=" },
          rightOperand: { kind: "ValueNode", value: "Acme" },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
          operator: { kind: "OperatorNode", operator: "!=" },
          rightOperand: { kind: "ValueNode", value: null },
        },
      },
    });
    expect(Object.isFrozen(filteredQuery.toOperationNode().where)).toBe(true);
    expect(
      Object.isFrozen(filteredQuery.toOperationNode().where?.where),
    ).toBe(true);
  });

  it("preserves the selected output type after filtering", () => {
    const db = new Kysoql<FixtureSchema>();
    const query = db
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "=", "Acme");

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });

  it("rejects invalid filters at compile time", () => {
    const db = new Kysoql<FixtureSchema>();
    const query = db.selectFrom("Account");

    query.where("Name", "=", "Acme");
    query.where("Name", "=", null);
    query.where("AnnualRevenue", "!=", 100);

    // @ts-expect-error Number fields require numeric filter values.
    query.where("AnnualRevenue", "=", "100");

    // @ts-expect-error Non-nullable fields don't accept null filter values.
    query.where("Id", "=", null);

    // @ts-expect-error Generated metadata marks this field as non-filterable.
    query.where("Internal_Note__c", "=", "private");

    // @ts-expect-error Only the first equality comparison operators are supported in this slice.
    query.where("Name", "like", "Acme%");

    // @ts-expect-error Salesforce field is not present on Account.
    query.where("Does_Not_Exist__c", "=", "value");
  });

  it("rejects unknown objects and fields at compile time", () => {
    const db = new Kysoql<FixtureSchema>();

    // @ts-expect-error Object is not present in the generated schema.
    db.selectFrom("Does_Not_Exist__c");

    const query = db.selectFrom("Account");

    // @ts-expect-error Salesforce field is not present on Account.
    query.select("Does_Not_Exist__c");

    // @ts-expect-error Every selected Salesforce field must exist on Account.
    query.select(["Id", "Does_Not_Exist__c"]);
  });
});
