import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { soqlDate, soqlDateTime, soqlTime } from "#/soql-temporal-literal";
import type { SalesforceField, SalesforceObject } from "#/schema";
import type { Simplify } from "#/util/type-utils";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";

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
    readonly CloseDate: SalesforceField<
      string,
      "date",
      true,
      true,
      true,
      true
    >;
    readonly LastActivityAt__c: SalesforceField<
      string,
      "datetime",
      true,
      true,
      true,
      true
    >;
    readonly OpeningTime__c: SalesforceField<
      string,
      "time",
      true,
      true,
      true,
      true
    >;
    readonly Industry: SalesforceField<
      string,
      "picklist",
      true,
      true,
      true,
      true,
      never,
      never,
      "Technology" | "Energy"
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

  it("keeps temporal result values as generated strings", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["CloseDate", "LastActivityAt__c", "OpeningTime__c"]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly CloseDate: string | null;
      readonly LastActivityAt__c: string | null;
      readonly OpeningTime__c: string | null;
    }>();
  });

  it("adds sortable ORDER BY items without mutating earlier builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const baseQuery = db.selectFrom("Account").select(["Id", "Name"]);
    const nameQuery = baseQuery.orderBy("Name", "asc");
    const orderedQuery = nameQuery.orderBy("Id", "desc");

    expect(baseQuery.toOperationNode().orderBy).toBeUndefined();
    expect(nameQuery.toOperationNode().orderBy).toEqual({
      kind: "OrderByNode",
      items: [
        {
          kind: "OrderByItemNode",
          orderBy: { kind: "ReferenceNode", name: "Name" },
          direction: "asc",
        },
      ],
    });
    expect(orderedQuery.toOperationNode().orderBy).toEqual({
      kind: "OrderByNode",
      items: [
        {
          kind: "OrderByItemNode",
          orderBy: { kind: "ReferenceNode", name: "Name" },
          direction: "asc",
        },
        {
          kind: "OrderByItemNode",
          orderBy: { kind: "ReferenceNode", name: "Id" },
          direction: "desc",
        },
      ],
    });
    expect(Object.isFrozen(orderedQuery.toOperationNode().orderBy)).toBe(true);
    expect(Object.isFrozen(orderedQuery.toOperationNode().orderBy?.items)).toBe(
      true,
    );
    expect(
      Object.isFrozen(orderedQuery.toOperationNode().orderBy?.items[0]),
    ).toBe(true);
  });

  it("sets and replaces LIMIT without mutating earlier builders", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);
    const limitedQuery = baseQuery.limit(25);
    const relimitedQuery = limitedQuery.limit(0);

    expect(baseQuery.toOperationNode().limit).toBeUndefined();
    expect(limitedQuery.toOperationNode().limit).toEqual({
      kind: "LimitNode",
      limit: 25,
    });
    expect(relimitedQuery.toOperationNode().limit).toEqual({
      kind: "LimitNode",
      limit: 0,
    });
    expect(Object.isFrozen(limitedQuery.toOperationNode().limit)).toBe(true);
    expect(Object.isFrozen(relimitedQuery.toOperationNode().limit)).toBe(true);
  });

  it("preserves the selected output type after limiting", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .limit(25);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });

  it("rejects invalid LIMIT values at runtime", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    for (const invalidLimit of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => query.limit(invalidLimit)).toThrow(
        "SOQL LIMIT must be a non-negative safe integer.",
      );
    }
  });

  it("preserves the selected output type after ordering", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .orderBy("AnnualRevenue", "desc");

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
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

  it("builds field-aware ordered and LIKE comparisons", () => {
    const db = new Kysoql<FixtureSchema>();
    const query = db
      .selectFrom("Account")
      .select(["Id", "Name", "AnnualRevenue"])
      .where("Name", "like", "Acme%")
      .where("AnnualRevenue", ">=", 100_000);

    expect(query.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "AndNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "like" },
          rightOperand: { kind: "ValueNode", value: "Acme%" },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
          operator: { kind: "OperatorNode", operator: ">=" },
          rightOperand: { kind: "ValueNode", value: 100_000 },
        },
      },
    });
  });

  it("stores explicit temporal literals in the immutable filter AST", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "=", soqlDate("2026-09-17"))
      .where(
        "LastActivityAt__c",
        ">=",
        soqlDateTime("2026-09-17T16:26:30+10:00"),
      )
      .where("OpeningTime__c", "<", soqlTime("17:30:00.000Z"));

    expect(query.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "AndNode",
        left: {
          kind: "AndNode",
          left: {
            kind: "BinaryOperationNode",
            leftOperand: { kind: "ReferenceNode", name: "CloseDate" },
            operator: { kind: "OperatorNode", operator: "=" },
            rightOperand: {
              kind: "ValueNode",
              value: { kind: "SoqlDateLiteral", value: "2026-09-17" },
            },
          },
          right: {
            kind: "BinaryOperationNode",
            leftOperand: {
              kind: "ReferenceNode",
              name: "LastActivityAt__c",
            },
            operator: { kind: "OperatorNode", operator: ">=" },
            rightOperand: {
              kind: "ValueNode",
              value: {
                kind: "SoqlDateTimeLiteral",
                value: "2026-09-17T16:26:30+10:00",
              },
            },
          },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "OpeningTime__c" },
          operator: { kind: "OperatorNode", operator: "<" },
          rightOperand: {
            kind: "ValueNode",
            value: { kind: "SoqlTimeLiteral", value: "17:30:00.000Z" },
          },
        },
      },
    });
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
    query.where("Name", "like", "Acme%");
    query.where("Name", "<", "Z");
    query.where("Industry", "like", "Tech%");
    query.where("AnnualRevenue", "!=", 100);
    query.where("AnnualRevenue", ">=", 100);
    query.where("CloseDate", "=", soqlDate("2026-09-17"));
    query.where("CloseDate", "=", null);
    query.where(
      "LastActivityAt__c",
      ">=",
      soqlDateTime("2026-09-17T16:26:30Z"),
    );
    query.where("OpeningTime__c", "<", soqlTime("17:30:00.000Z"));

    // @ts-expect-error Number fields require numeric filter values.
    query.where("AnnualRevenue", "=", "100");

    // @ts-expect-error Date fields require an explicit SOQL date literal.
    query.where("CloseDate", "=", "2026-09-17");

    // @ts-expect-error DateTime fields require an explicit SOQL dateTime literal.
    query.where("LastActivityAt__c", ">=", "2026-09-17T16:26:30Z");

    // @ts-expect-error Time fields require an explicit SOQL time literal.
    query.where("OpeningTime__c", "=", "17:30:00.000Z");

    // @ts-expect-error Temporal wrappers must match the Salesforce field type.
    query.where("CloseDate", "=", soqlDateTime("2026-09-17T00:00:00Z"));

    // @ts-expect-error Temporal wrappers aren't string field values.
    query.where("Name", "=", soqlDate("2026-09-17"));

    // @ts-expect-error Non-nullable fields don't accept null equality values.
    query.where("Id", "=", null);

    // @ts-expect-error Ordered comparisons don't accept null, even for nullable fields.
    query.where("AnnualRevenue", ">", null);

    // @ts-expect-error LIKE doesn't accept null, even for nullable string fields.
    query.where("Name", "like", null);

    // @ts-expect-error LIKE is restricted to Salesforce string-like field types.
    query.where("AnnualRevenue", "like", "100%");

    // @ts-expect-error Picklists support LIKE but not ordered comparisons in this slice.
    query.where("Industry", ">", "Technology");

    // @ts-expect-error Salesforce Id fields don't support LIKE.
    query.where("Id", "like", "001%");

    const recordQuery = db.selectFrom("Kysoql_Record__c");

    // @ts-expect-error Boolean fields don't support ordered comparisons.
    recordQuery.where("Active__c", ">", true);

    // @ts-expect-error Boolean fields don't support LIKE.
    recordQuery.where("Active__c", "like", "true%");

    // @ts-expect-error Generated metadata marks this field as non-filterable.
    query.where("Internal_Note__c", "=", "private");

    // @ts-expect-error Salesforce field is not present on Account.
    query.where("Does_Not_Exist__c", "=", "value");
  });

  it("requires numeric LIMIT values at compile time", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    expectTypeOf(query.limit).parameter(0).toEqualTypeOf<number>();
  });

  it("rejects invalid ordering at compile time", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    query.orderBy("Name");
    query.orderBy("AnnualRevenue", "asc");
    query.orderBy("Id", "desc");

    // @ts-expect-error Generated metadata marks this field as non-sortable.
    query.orderBy("Internal_Note__c");

    // @ts-expect-error Salesforce field is not present on Account.
    query.orderBy("Does_Not_Exist__c");

    // @ts-expect-error ORDER BY direction is limited to Kysely-style asc/desc.
    query.orderBy("Name", "ascending");
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
