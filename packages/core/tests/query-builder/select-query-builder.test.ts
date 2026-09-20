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

type CustomField<
  Value,
  SalesforceType extends string,
  Nullable extends boolean,
  Filterable extends boolean,
  Sortable extends boolean,
  Groupable extends boolean,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
  ActivePicklistValue extends string = never,
  Aggregatable extends boolean = false,
> = SalesforceField<
  Value,
  SalesforceType,
  Nullable,
  Filterable,
  Sortable,
  Groupable,
  ReferenceTo,
  RelationshipName,
  ActivePicklistValue,
  Aggregatable,
  true
>;

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
      readonly CommittedRevenue__c: CustomField<
        number,
        "currency",
        false,
        true,
        true,
        true
      >;
      readonly EmployeeCount__c: CustomField<
        number,
        "int",
        false,
        true,
        true,
        true
      >;
      readonly Satisfaction__c: CustomField<
        number,
        "double",
        true,
        true,
        true,
        true
      >;
      readonly GrowthRate__c: CustomField<
        number,
        "percent",
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
      readonly LastActivityAt__c: CustomField<
        string,
        "datetime",
        true,
        true,
        true,
        true
      >;
      readonly FilterOnlyDate__c: CustomField<
        string,
        "date",
        true,
        true,
        false,
        false
      >;
      readonly InternalDate__c: CustomField<
        string,
        "date",
        true,
        false,
        false,
        false
      >;
      readonly OpeningTime__c: CustomField<
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
      readonly Tags__c: CustomField<
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
      readonly Internal_Note__c: CustomField<
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
    readonly Active__c: CustomField<
      boolean,
      "boolean",
      false,
      true,
      true,
      true
    >;
  }>;
  readonly User: SalesforceObject<{
    readonly Quota__c: CustomField<number, "currency", false, true, true, true>;
    readonly Region__c: CustomField<
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

  it("selects typed standard and custom field groups immutably", () => {
    const baseQuery = new Kysoql<FixtureSchema>().selectFrom("Account");
    const standardQuery = baseQuery.selectFields("standard");
    const customQuery = baseQuery.selectFields("custom").limit(200);
    const combinedQuery = standardQuery.selectFields("custom").limit(25);
    const allQuery = baseQuery.selectFields("all").limit(200);
    const mixedQuery = baseQuery.select("Id").selectFields("custom").limit(200);
    const relatedQuery = baseQuery
      .select("Owner.Region__c")
      .selectFields("all")
      .limit(200);

    expect(baseQuery.toOperationNode().selections).toBeUndefined();
    expect(standardQuery.toOperationNode().selections).toEqual([
      {
        kind: "SelectionNode",
        selection: {
          kind: "FieldsFunctionNode",
          selector: "standard",
        },
      },
    ]);
    expect(Object.isFrozen(standardQuery.toOperationNode().selections)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        standardQuery.toOperationNode().selections?.[0]?.selection,
      ),
    ).toBe(true);
    expect(standardQuery.compile().soql).toBe(
      "SELECT FIELDS(STANDARD) FROM Account",
    );
    expect(customQuery.compile().soql).toBe(
      "SELECT FIELDS(CUSTOM) FROM Account LIMIT 200",
    );
    expect(combinedQuery.compile().soql).toBe(
      "SELECT FIELDS(STANDARD), FIELDS(CUSTOM) FROM Account LIMIT 25",
    );
    expect(allQuery.compile().soql).toBe(
      "SELECT FIELDS(ALL) FROM Account LIMIT 200",
    );
    expect(mixedQuery.compile().soql).toBe(
      "SELECT Id, FIELDS(CUSTOM) FROM Account LIMIT 200",
    );
    expect(relatedQuery.compile().soql).toBe(
      "SELECT Owner.Region__c, FIELDS(ALL) FROM Account LIMIT 200",
    );

    expectTypeOf<Simplify<OutputOf<typeof standardQuery>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
      readonly AnnualRevenue: number | null;
      readonly CloseDate: string | null;
      readonly Industry: string | null;
      readonly OwnerId: string;
    }>();
    expectTypeOf<Simplify<OutputOf<typeof customQuery>>>().toEqualTypeOf<{
      readonly CommittedRevenue__c: number;
      readonly EmployeeCount__c: number;
      readonly Satisfaction__c: number | null;
      readonly GrowthRate__c: number;
      readonly LastActivityAt__c: string | null;
      readonly FilterOnlyDate__c: string | null;
      readonly InternalDate__c: string | null;
      readonly OpeningTime__c: string | null;
      readonly Tags__c: string;
      readonly Internal_Note__c: string | null;
    }>();
    expectTypeOf<Simplify<OutputOf<typeof combinedQuery>>>().toEqualTypeOf<
      Simplify<OutputOf<typeof standardQuery> & OutputOf<typeof customQuery>>
    >();
    expectTypeOf<Simplify<OutputOf<typeof allQuery>>>().toEqualTypeOf<
      Simplify<OutputOf<typeof standardQuery> & OutputOf<typeof customQuery>>
    >();
  });

  it("rejects overlapping and unknown field-group selections at compile time", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    void (() => {
      // @ts-expect-error FIELDS selectors are restricted to Salesforce's three documented groups.
      query.selectFields("unknown");

      const selectedFirst = query.select("Id");
      // @ts-expect-error FIELDS(STANDARD) would select Id a second time.
      selectedFirst.selectFields("standard");

      const fieldsFirst = query.selectFields("custom");
      // @ts-expect-error Explicit direct selections cannot overlap a selected FIELDS group.
      fieldsFirst.select(["Name", "CommittedRevenue__c"]);

      const allFields = query.selectFields("all");
      // @ts-expect-error FIELDS(ALL) overlaps every other FIELDS group.
      allFields.selectFields("custom");
    });
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

  it("selects aliased localized values with inferred output", () => {
    const baseQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const query = baseQuery.select(({ fn }) => [
      fn.format("AnnualRevenue").as("formattedRevenue"),
      fn.format("CommittedRevenue__c").as("formattedCommittedRevenue"),
      fn.format("EmployeeCount__c").as("formattedEmployeeCount"),
      fn.format("Satisfaction__c").as("formattedSatisfaction"),
      fn.format("GrowthRate__c").as("formattedGrowthRate"),
      fn.format("CloseDate").as("formattedCloseDate"),
      fn.format("LastActivityAt__c").as("formattedLastActivity"),
      fn.format("OpeningTime__c").as("formattedOpeningTime"),
      fn.format("Owner.Quota__c").as("formattedOwnerQuota"),
      fn
        .format(fn.convertCurrency("AnnualRevenue"))
        .as("formattedConvertedRevenue"),
      fn
        .format(fn.convertCurrency("CommittedRevenue__c"))
        .as("formattedConvertedCommittedRevenue"),
    ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly formattedRevenue: string | null;
      readonly formattedCommittedRevenue: string;
      readonly formattedEmployeeCount: string;
      readonly formattedSatisfaction: string | null;
      readonly formattedGrowthRate: string;
      readonly formattedCloseDate: string | null;
      readonly formattedLastActivity: string | null;
      readonly formattedOpeningTime: string | null;
      readonly formattedOwnerQuota: string | null;
      readonly formattedConvertedRevenue: string | null;
      readonly formattedConvertedCommittedRevenue: string;
    }>();
    expect(baseQuery.toOperationNode().selections).toHaveLength(1);
    expect(query.toOperationNode().selections?.[1]).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "AliasNode",
        alias: "formattedRevenue",
        node: {
          kind: "FormatFunctionNode",
          expression: { kind: "ReferenceNode", name: "AnnualRevenue" },
        },
      },
    });
    expect(query.toOperationNode().selections?.at(-2)).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "AliasNode",
        alias: "formattedConvertedRevenue",
        node: {
          kind: "FormatFunctionNode",
          expression: {
            kind: "ConvertCurrencyFunctionNode",
            reference: { kind: "ReferenceNode", name: "AnnualRevenue" },
          },
        },
      },
    });
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
    expect(() =>
      baseQuery.select(({ fn }) => fn.format("CloseDate") as never),
    ).toThrow("SOQL SELECT function expressions must be aliased.");
    expect(() =>
      baseQuery.select(({ fn }) =>
        fn.format(fn.toLabel("Industry") as never).as("formattedIndustry"),
      ),
    ).toThrow(
      "SOQL FORMAT() only supports field references, unaliased convertCurrency() expressions, or unaliased aggregate functions with field arguments.",
    );

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

  it("stores date-function WHERE expressions without requiring groupable fields", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where((eb) =>
        eb.and([
          eb(eb.fn.calendarYear("FilterOnlyDate__c"), "=", 2026),
          eb(
            eb.fn.dayOnly(eb.fn.convertTimezone("LastActivityAt__c")),
            ">=",
            soqlDate("2026-09-20"),
          ),
        ]),
      );

    expect(query.toOperationNode().where).toEqual({
      kind: "WhereNode",
      where: {
        kind: "AndNode",
        left: {
          kind: "BinaryOperationNode",
          leftOperand: {
            kind: "DateFunctionNode",
            function: "calendarYear",
            reference: {
              kind: "ReferenceNode",
              name: "FilterOnlyDate__c",
            },
          },
          operator: { kind: "OperatorNode", operator: "=" },
          rightOperand: { kind: "ValueNode", value: 2026 },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: {
            kind: "DateFunctionNode",
            function: "dayOnly",
            reference: {
              kind: "ConvertTimezoneFunctionNode",
              reference: {
                kind: "ReferenceNode",
                name: "LastActivityAt__c",
              },
            },
          },
          operator: { kind: "OperatorNode", operator: ">=" },
          rightOperand: {
            kind: "ValueNode",
            value: { kind: "SoqlDateLiteral", value: "2026-09-20" },
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

    query.where((eb) => eb(eb.fn.calendarMonth("CloseDate"), "=", 9));
    query.where((eb) => eb(eb.fn.calendarQuarter("CloseDate"), "=", 3));
    query.where((eb) => eb(eb.fn.calendarYear("CloseDate"), ">=", 2026));
    query.where((eb) => eb(eb.fn.dayInMonth("CloseDate"), "=", 20));
    query.where((eb) => eb(eb.fn.dayInWeek("CloseDate"), "=", 1));
    query.where((eb) => eb(eb.fn.dayInYear("CloseDate"), "=", 263));
    query.where((eb) =>
      eb(eb.fn.dayOnly("LastActivityAt__c"), "=", soqlDate("2026-09-20")),
    );
    query.where((eb) => eb(eb.fn.fiscalMonth("CloseDate"), "=", 9));
    query.where((eb) => eb(eb.fn.fiscalQuarter("CloseDate"), "=", 3));
    query.where((eb) => eb(eb.fn.fiscalYear("CloseDate"), "=", 2026));
    query.where((eb) => eb(eb.fn.hourInDay("LastActivityAt__c"), "=", 14));
    query.where((eb) => eb(eb.fn.weekInMonth("CloseDate"), "=", 3));
    query.where((eb) => eb(eb.fn.weekInYear("CloseDate"), "=", 38));
    query.where((eb) =>
      eb(eb.fn.calendarYear("FilterOnlyDate__c"), "in", [2025, 2026]),
    );
    query.where((eb) =>
      eb(
        eb.fn.calendarYear(eb.fn.convertTimezone("LastActivityAt__c")),
        "=",
        2026,
      ),
    );

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

    query.where((eb) => {
      // @ts-expect-error Date functions require generated date/datetime fields.
      const year = eb.fn.calendarYear("Name");
      return eb(year, "=", 2026);
    });

    query.where((eb) => {
      // @ts-expect-error Date functions require filterable fields in WHERE.
      const year = eb.fn.calendarYear("InternalDate__c");
      return eb(year, "=", 2026);
    });

    query.where((eb) => {
      // @ts-expect-error DAY_ONLY accepts datetime fields only.
      const day = eb.fn.dayOnly("CloseDate");
      return eb(day, "=", soqlDate("2026-09-20"));
    });

    query.where((eb) => {
      // @ts-expect-error convertTimezone accepts datetime fields only.
      const local = eb.fn.convertTimezone("CloseDate");
      return eb(eb.fn.calendarYear(local), "=", 2026);
    });

    query.where((eb) => {
      const year = eb.fn.calendarYear("CloseDate");
      // @ts-expect-error Numeric date functions require numeric comparison values.
      return eb(year, "=", "2026");
    });

    query.where((eb) => {
      const year = eb.fn.calendarYear("CloseDate");
      // @ts-expect-error Ordered date-function comparisons reject null.
      return eb(year, ">", null);
    });

    query.where((eb) => {
      const day = eb.fn.dayOnly("LastActivityAt__c");
      const dateTime = soqlDateTime("2026-09-20T00:00:00Z");
      // @ts-expect-error DAY_ONLY requires a SOQL date literal comparison value.
      return eb(day, "=", dateTime);
    });
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
    query.select(({ fn }) => fn.format("AnnualRevenue").as("revenueLabel"));
    query.select(({ fn }) =>
      fn.format(fn.convertCurrency("Owner.Quota__c")).as("formattedOwnerQuota"),
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

    const invalidFormatSelections = () => {
      query.select(({ fn }) => {
        // @ts-expect-error FORMAT requires a generated number, date, datetime, time, or currency field.
        return fn.format("Name").as("formattedName");
      });
      query.select(({ fn }) => {
        // @ts-expect-error FORMAT does not accept picklist fields.
        return fn.format("Industry").as("formattedIndustry");
      });
      query.select(({ fn }) => {
        // @ts-expect-error FORMAT fields must exist in the generated schema.
        return fn.format("Does_Not_Exist__c").as("formattedMissing");
      });
      query.select(({ fn }) => {
        // @ts-expect-error FORMAT nesting is currently limited to unaliased convertCurrency expressions.
        return fn.format(fn.toLabel("Industry")).as("formattedIndustry");
      });
      query.select(({ fn }) => {
        return (
          fn
            // @ts-expect-error Aliased convertCurrency selections cannot be nested inside FORMAT.
            .format(fn.convertCurrency("AnnualRevenue").as("convertedRevenue"))
            .as("formattedRevenue")
        );
      });
      // @ts-expect-error SELECT function expressions require deterministic aliases.
      query.select(({ fn }) => fn.format("CloseDate"));
      // @ts-expect-error Salesforce does not support ordering by FORMAT expressions.
      query.orderBy(({ fn }) => fn.format("CloseDate"));
    };

    expect(invalidFormatSelections).toBeTypeOf("function");
  });
});
