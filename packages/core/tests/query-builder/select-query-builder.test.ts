import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import { soqlDate, soqlDateTime, soqlTime } from "#/soql-temporal-literal";
import type { Simplify } from "#/util/type-utils";

interface FixtureSchema {
  readonly Account: SalesforceObject<
    {
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
      readonly CommittedRevenue__c: SalesforceField<
        number,
        "currency",
        false,
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
      readonly Tags__c: SalesforceField<
        string,
        "multipicklist",
        false,
        true,
        true,
        true,
        never,
        never,
        "Priority" | "Strategic"
      >;
      readonly Internal_Note__c: SalesforceField<
        string,
        "string",
        true,
        false,
        false,
        false
      >;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
    }
  >;
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
  readonly User: SalesforceObject<{
    readonly Quota__c: SalesforceField<
      number,
      "currency",
      false,
      true,
      true,
      true
    >;
    readonly Region__c: SalesforceField<
      string,
      "picklist",
      false,
      true,
      true,
      true,
      never,
      never,
      "ANZ" | "APAC"
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

  it("selects aliased translated picklist labels with inferred output", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const query = baseQuery.select(({ fn }) => [
      fn.toLabel("Industry").as("industryLabel"),
      fn.toLabel("Owner.Region__c").as("ownerRegionLabel"),
      fn.toLabel("Tags__c").as("tagLabels"),
    ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly industryLabel: string | null;
      readonly ownerRegionLabel: string | null;
      readonly tagLabels: string;
    }>();
    expect(baseQuery.toOperationNode().selections).toHaveLength(1);
    expect(query.toOperationNode().selections?.slice(1)).toEqual([
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "industryLabel",
          node: {
            kind: "ToLabelFunctionNode",
            reference: { kind: "ReferenceNode", name: "Industry" },
          },
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "ownerRegionLabel",
          node: {
            kind: "ToLabelFunctionNode",
            reference: {
              kind: "ReferenceNode",
              name: "Owner.Region__c",
            },
          },
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "tagLabels",
          node: {
            kind: "ToLabelFunctionNode",
            reference: { kind: "ReferenceNode", name: "Tags__c" },
          },
        },
      },
    ]);
    expect(Object.isFrozen(query.toOperationNode().selections?.[1])).toBe(true);
    expect(
      Object.isFrozen(query.toOperationNode().selections?.[1]?.selection),
    ).toBe(true);
  });

  it("selects aliased converted currencies with inferred output", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const query = baseQuery.select(({ fn }) => [
      fn.convertCurrency("AnnualRevenue").as("convertedRevenue"),
      fn.convertCurrency("CommittedRevenue__c").as("convertedCommittedRevenue"),
      fn.convertCurrency("Owner.Quota__c").as("convertedOwnerQuota"),
    ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly convertedRevenue: number | null;
      readonly convertedCommittedRevenue: number;
      readonly convertedOwnerQuota: number | null;
    }>();
    expect(baseQuery.toOperationNode().selections).toHaveLength(1);
    expect(query.toOperationNode().selections?.slice(1)).toEqual([
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "convertedRevenue",
          node: {
            kind: "ConvertCurrencyFunctionNode",
            reference: { kind: "ReferenceNode", name: "AnnualRevenue" },
          },
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "convertedCommittedRevenue",
          node: {
            kind: "ConvertCurrencyFunctionNode",
            reference: {
              kind: "ReferenceNode",
              name: "CommittedRevenue__c",
            },
          },
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "convertedOwnerQuota",
          node: {
            kind: "ConvertCurrencyFunctionNode",
            reference: { kind: "ReferenceNode", name: "Owner.Quota__c" },
          },
        },
      },
    ]);
    expect(Object.isFrozen(query.toOperationNode().selections?.[1])).toBe(true);
    expect(
      Object.isFrozen(query.toOperationNode().selections?.[1]?.selection),
    ).toBe(true);
  });

  it("rejects invalid SELECT-function selections at runtime", () => {
    const baseQuery = new Kysoql<FixtureSchema>().selectFrom("Account");

    expect(() =>
      baseQuery.select(({ fn }) => fn.toLabel("Industry") as never),
    ).toThrow("SOQL SELECT function expressions must be aliased.");
    expect(() =>
      baseQuery.select(({ fn }) => [
        fn.toLabel("Industry").as("label"),
        fn.convertCurrency("AnnualRevenue").as("label"),
      ]),
    ).toThrow("Duplicate SOQL selection alias: label.");
    expect(() =>
      baseQuery.select(
        ({ fn }) => fn.convertCurrency("AnnualRevenue") as never,
      ),
    ).toThrow("SOQL SELECT function expressions must be aliased.");

    const selected = baseQuery.select(({ fn }) =>
      fn.toLabel("Industry").as("label"),
    );
    expect(() =>
      selected.select(({ fn }) => fn.toLabel("Industry").as("label")),
    ).toThrow("Duplicate SOQL selection alias: label.");
  });

  it("adds sortable ORDER BY items without mutating earlier builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const baseQuery = db.selectFrom("Account").select(["Id", "Name"]);
    const nameQuery = baseQuery.orderBy("Name", "asc", "first");
    const orderedQuery = nameQuery.orderBy("Id", "desc", "last");

    expect(baseQuery.toOperationNode().orderBy).toBeUndefined();
    expect(nameQuery.toOperationNode().orderBy).toEqual({
      kind: "OrderByNode",
      items: [
        {
          kind: "OrderByItemNode",
          orderBy: { kind: "ReferenceNode", name: "Name" },
          direction: "asc",
          nulls: "first",
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
          nulls: "first",
        },
        {
          kind: "OrderByItemNode",
          orderBy: { kind: "ReferenceNode", name: "Id" },
          direction: "desc",
          nulls: "last",
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

  it("sets and replaces OFFSET without mutating earlier builders", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);
    const offsetQuery = baseQuery.offset(25);
    const reoffsetQuery = offsetQuery.offset(0);

    expect(baseQuery.toOperationNode().offset).toBeUndefined();
    expect(offsetQuery.toOperationNode().offset).toEqual({
      kind: "OffsetNode",
      offset: 25,
    });
    expect(reoffsetQuery.toOperationNode().offset).toEqual({
      kind: "OffsetNode",
      offset: 0,
    });
    expect(Object.isFrozen(offsetQuery.toOperationNode().offset)).toBe(true);
    expect(Object.isFrozen(reoffsetQuery.toOperationNode().offset)).toBe(true);
  });

  it("preserves the selected output type after offsetting", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .offset(25);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });

  it("rejects invalid OFFSET values at runtime", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    for (const invalidOffset of [
      -1,
      1.5,
      2001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => query.offset(invalidOffset)).toThrow(
        "SOQL OFFSET must be a safe integer between 0 and 2000.",
      );
    }
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
    expect(Object.isFrozen(filteredQuery.toOperationNode().where?.where)).toBe(
      true,
    );
  });

  it("groups typed OR comparisons inside WHERE", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);
    const orQuery = baseQuery.where((eb) =>
      eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
    );
    const filteredQuery = orQuery.where("Name", "!=", null);

    expect(baseQuery.toOperationNode().where).toBeUndefined();
    expect(orQuery.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "OrNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "=" },
          rightOperand: { kind: "ValueNode", value: "Acme" },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
          operator: { kind: "OperatorNode", operator: ">=" },
          rightOperand: { kind: "ValueNode", value: 100_000 },
        },
      },
    });
    expect(filteredQuery.toOperationNode().where?.where).toEqual({
      kind: "AndNode",
      left: orQuery.toOperationNode().where?.where,
      right: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Name" },
        operator: { kind: "OperatorNode", operator: "!=" },
        rightOperand: { kind: "ValueNode", value: null },
      },
    });
    expect(Object.isFrozen(orQuery.toOperationNode().where?.where)).toBe(true);
  });

  it("groups nested AND expressions inside WHERE", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where((eb) =>
        eb.and([
          eb("Name", "!=", null),
          eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
        ]),
      );

    expect(query.toOperationNode().where?.where).toEqual({
      kind: "AndNode",
      left: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Name" },
        operator: { kind: "OperatorNode", operator: "!=" },
        rightOperand: { kind: "ValueNode", value: null },
      },
      right: {
        kind: "OrNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "=" },
          rightOperand: { kind: "ValueNode", value: "Acme" },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
          operator: { kind: "OperatorNode", operator: ">=" },
          rightOperand: { kind: "ValueNode", value: 100_000 },
        },
      },
    });
    expect(Object.isFrozen(query.toOperationNode().where?.where)).toBe(true);
  });

  it("negates grouped expressions inside WHERE", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where((eb) =>
        eb.not(
          eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100_000)]),
        ),
      );

    expect(query.toOperationNode().where?.where).toEqual({
      kind: "NotNode",
      operand: {
        kind: "OrNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "=" },
          rightOperand: { kind: "ValueNode", value: "Acme" },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
          operator: { kind: "OperatorNode", operator: ">=" },
          rightOperand: { kind: "ValueNode", value: 100_000 },
        },
      },
    });
    expect(Object.isFrozen(query.toOperationNode().where?.where)).toBe(true);
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

    query.where((eb) =>
      eb.or([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100)]),
    );

    query.where((eb) =>
      eb.and([eb("Name", "=", "Acme"), eb("AnnualRevenue", ">=", 100)]),
    );

    query.where((eb) => eb.not(eb("Name", "=", "Acme")));

    query.where((eb) =>
      eb.or([
        eb("Name", "=", "Acme"),
        // @ts-expect-error Expression-builder comparisons preserve field-aware value types.
        eb("AnnualRevenue", "=", "100"),
      ]),
    );

    query.where((eb) =>
      eb.and([
        eb("Name", "=", "Acme"),
        // @ts-expect-error Grouped AND comparisons preserve field-aware value types.
        eb("AnnualRevenue", "=", "100"),
      ]),
    );

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

  it("requires numeric OFFSET values at compile time", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    expectTypeOf(query.offset).parameter(0).toEqualTypeOf<number>();
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

    query.orderBy("Name", undefined, "first");
    query.orderBy("Name", "asc", "last");

    // @ts-expect-error ORDER BY null placement is limited to first/last.
    query.orderBy("Name", "asc", "middle");
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

    query.select(({ fn }) => fn.toLabel("Industry").as("industryLabel"));
    query.select(({ fn }) =>
      fn.toLabel("Owner.Region__c").as("ownerRegionLabel"),
    );
    query.select(({ fn }) =>
      fn.convertCurrency("AnnualRevenue").as("convertedRevenue"),
    );
    query.select(({ fn }) =>
      fn.convertCurrency("Owner.Quota__c").as("convertedOwnerQuota"),
    );

    const invalidToLabelSelections = () => {
      // @ts-expect-error toLabel requires a generated picklist or multipicklist field.
      query.select(({ fn }) => fn.toLabel("Name").as("nameLabel"));
      query.select(({ fn }) => {
        // @ts-expect-error toLabel does not accept numeric fields.
        return fn.toLabel("AnnualRevenue").as("revenueLabel");
      });
      query.select(({ fn }) => {
        // @ts-expect-error toLabel fields must exist in the generated schema.
        return fn.toLabel("Does_Not_Exist__c").as("missingLabel");
      });
      // @ts-expect-error SELECT function expressions require deterministic aliases.
      query.select(({ fn }) => fn.toLabel("Industry"));
      // @ts-expect-error Salesforce does not support ordering by toLabel expressions.
      query.orderBy(({ fn }) => fn.toLabel("Industry"));
    };

    expect(invalidToLabelSelections).toBeTypeOf("function");

    const invalidConvertCurrencySelections = () => {
      query.select(({ fn }) => {
        // @ts-expect-error convertCurrency requires a generated currency field.
        return fn.convertCurrency("Name").as("convertedName");
      });
      query.select(({ fn }) => {
        // @ts-expect-error convertCurrency does not accept picklist fields.
        return fn.convertCurrency("Industry").as("convertedIndustry");
      });
      query.select(({ fn }) => {
        // @ts-expect-error convertCurrency fields must exist in the generated schema.
        return fn.convertCurrency("Does_Not_Exist__c").as("convertedMissing");
      });
      // @ts-expect-error SELECT function expressions require deterministic aliases.
      query.select(({ fn }) => fn.convertCurrency("AnnualRevenue"));
      // @ts-expect-error Salesforce does not support ordering by convertCurrency expressions.
      query.orderBy(({ fn }) => fn.convertCurrency("AnnualRevenue"));
    };

    expect(invalidConvertCurrencySelections).toBeTypeOf("function");
  });
});
