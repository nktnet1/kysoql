import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { Kysoql } from "#/kysoql";
import type { AggregateSelectQueryBuilder } from "#/query-builder/aggregate-select-query-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryExecutor } from "#/query-executor";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type AggregatableField<
  Value,
  SalesforceType extends string,
  Nullable extends boolean,
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
  true
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: AggregatableField<string, "id", false>;
      readonly Name: AggregatableField<string, "string", true>;
      readonly AnnualRevenue: AggregatableField<number, "currency", true>;
      readonly EmployeeCount__c: AggregatableField<number, "int", true>;
      readonly CloseDate: AggregatableField<string, "date", true>;
      readonly CreatedDate: AggregatableField<string, "datetime", false>;
      readonly OwnerId: AggregatableField<string, "reference", false>;
      readonly Active__c: SalesforceField<
        boolean,
        "boolean",
        false,
        true,
        true,
        true,
        never,
        never,
        never,
        false
      >;
      readonly Internal_Note__c: SalesforceField<
        string,
        "string",
        true,
        true,
        false,
        false,
        never,
        never,
        never,
        false
      >;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
    }
  >;
  readonly User: SalesforceObject<{
    readonly CreatedDate: AggregatableField<string, "datetime", false>;
    readonly Name: AggregatableField<string, "string", false>;
  }>;
}

type OutputOf<Query> =
  Query extends AggregateSelectQueryBuilder<
    infer _DB,
    infer _TB,
    infer Output,
    infer _GroupedBy,
    infer _GroupMode,
    infer _AdvancedFieldCount
  >
    ? Output
    : never;

describe("aggregate queries", () => {
  it("builds immutable aliased aggregate selections and infers their output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.count("Id").as("rowCount"),
        fn.countDistinct("Name").as("distinctNames"),
        fn.sum("AnnualRevenue").as("totalRevenue"),
        fn.avg("EmployeeCount__c").as("averageEmployees"),
        fn.min("CloseDate").as("firstCloseDate"),
        fn.max("Name").as("lastName"),
      ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly distinctNames: number;
      readonly totalRevenue: number | null;
      readonly averageEmployees: number | null;
      readonly firstCloseDate: string | null;
      readonly lastName: string | null;
    }>();

    const node = query.toOperationNode();
    expect(node.selections).toHaveLength(6);
    expect(node.selections?.[0]).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "AliasNode",
        alias: "rowCount",
        node: {
          kind: "AggregateFunctionNode",
          function: "count",
          reference: { kind: "ReferenceNode", name: "Id" },
        },
      },
    });
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.selections)).toBe(true);
    expect(Object.isFrozen(node.selections?.[0])).toBe(true);
    expect(Object.isFrozen(node.selections?.[0]?.selection)).toBe(true);
  });

  it("formats aliased aggregate selections with inferred output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.format(fn.count("Id")).as("formattedCount"),
        fn.format(fn.sum("AnnualRevenue")).as("formattedRevenue"),
        fn.format(fn.min("CloseDate")).as("formattedCloseDate"),
      ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly formattedCount: string;
      readonly formattedRevenue: string | null;
      readonly formattedCloseDate: string | null;
    }>();
    expect(query.compile().soql).toBe(
      "SELECT FORMAT(COUNT(Id)) formattedCount, FORMAT(SUM(AnnualRevenue)) formattedRevenue, FORMAT(MIN(CloseDate)) formattedCloseDate FROM Account",
    );
    expect(query.toOperationNode().selections?.[0]).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "AliasNode",
        alias: "formattedCount",
        node: {
          kind: "FormatFunctionNode",
          expression: {
            kind: "AggregateFunctionNode",
            function: "count",
            reference: { kind: "ReferenceNode", name: "Id" },
          },
        },
      },
    });
  });

  it("accumulates aliased aggregate selections without mutating earlier builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const countQuery = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));
    const fullQuery = countQuery.select(({ fn }) =>
      fn.sum("AnnualRevenue").as("totalRevenue"),
    );

    expect(countQuery.toOperationNode().selections).toHaveLength(1);
    expect(fullQuery.toOperationNode().selections).toHaveLength(2);
    expectTypeOf<Simplify<OutputOf<typeof fullQuery>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly totalRevenue: number | null;
    }>();
  });

  it("adds typed grouping and accumulates grouped fields into aggregate output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name")
      .groupBy(["Active__c", "Owner.Name"])
      .select(["Name", "Active__c", "Owner.Name"])
      .orderBy("Name", "desc", "last")
      .limit(25);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly Name: string | null;
      readonly Active__c: boolean;
      readonly Owner: {
        readonly Name: string;
      } | null;
    }>();

    const node = query.toOperationNode();
    expect(node.groupBy).toEqual({
      kind: "GroupByNode",
      items: [
        { kind: "ReferenceNode", name: "Name" },
        { kind: "ReferenceNode", name: "Active__c" },
        { kind: "ReferenceNode", name: "Owner.Name" },
      ],
    });
    expect(Object.isFrozen(node.groupBy)).toBe(true);
    expect(Object.isFrozen(node.groupBy?.items)).toBe(true);
  });

  it("adds typed ROLLUP grouping with nullable subtotal output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByRollup("Active__c")
      .groupByRollup(["Owner.Name"])
      .select(["Active__c", "Owner.Name"])
      .having((eb) => eb(eb.fn.count("Id"), ">", 1))
      .orderBy("Active__c")
      .limit(25);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly Active__c: boolean | null;
      readonly Owner: {
        readonly Name: string | null;
      } | null;
    }>();

    expect(query.toOperationNode().groupBy).toEqual({
      kind: "GroupByNode",
      items: [
        { kind: "ReferenceNode", name: "Active__c" },
        { kind: "ReferenceNode", name: "Owner.Name" },
      ],
      mode: "rollup",
    });
  });

  it("adds typed CUBE grouping with nullable subtotal output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
      .groupByCube(["Active__c", "Owner.Name"])
      .select(["Active__c", "Owner.Name"]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly totalRevenue: number | null;
      readonly Active__c: boolean | null;
      readonly Owner: {
        readonly Name: string | null;
      } | null;
    }>();
    expect(query.toOperationNode().groupBy?.mode).toBe("cube");
  });

  it("scopes GROUPING() to advanced fields and infers 0 | 1 output", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByCube(["Name", "Active__c"])
      .select(({ fn }) => [
        fn.grouping("Name").as("nameGrouping"),
        fn.grouping("Active__c").as("activeGrouping"),
      ])
      .having((eb) => eb(eb.fn.grouping("Name"), "=", 0))
      .orderBy(({ fn }) => fn.grouping("Name"), "asc");

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly nameGrouping: 0 | 1;
      readonly activeGrouping: 0 | 1;
    }>();

    expect(query.toOperationNode().selections?.[1]).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "AliasNode",
        alias: "nameGrouping",
        node: {
          kind: "AggregateFunctionNode",
          function: "grouping",
          reference: { kind: "ReferenceNode", name: "Name" },
        },
      },
    });
    expect(query.toOperationNode().orderBy?.items[0]?.orderBy).toEqual({
      kind: "AggregateFunctionNode",
      function: "grouping",
      reference: { kind: "ReferenceNode", name: "Name" },
    });
  });

  it("groups, selects, filters, and orders by typed date functions", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.calendarYear("CloseDate"))
      .groupBy(({ fn }) => fn.dayOnly("CreatedDate"))
      .groupBy(({ fn }) => fn.hourInDay("Owner.CreatedDate"))
      .select(({ fn }) => [
        fn.calendarYear("CloseDate").as("closeYear"),
        fn.dayOnly("CreatedDate").as("createdDay"),
        fn.hourInDay("Owner.CreatedDate").as("ownerCreatedHour"),
      ])
      .having((eb) => eb(eb.fn.calendarYear("CloseDate"), ">=", 2020))
      .orderBy(({ fn }) => fn.dayOnly("CreatedDate"), "desc");

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly closeYear: number | null;
      readonly createdDay: string;
      readonly ownerCreatedHour: number | null;
    }>();

    expect(query.toOperationNode().groupBy).toEqual({
      kind: "GroupByNode",
      items: [
        {
          kind: "DateFunctionNode",
          function: "calendarYear",
          reference: { kind: "ReferenceNode", name: "CloseDate" },
        },
        {
          kind: "DateFunctionNode",
          function: "dayOnly",
          reference: { kind: "ReferenceNode", name: "CreatedDate" },
        },
        {
          kind: "DateFunctionNode",
          function: "hourInDay",
          reference: {
            kind: "ReferenceNode",
            name: "Owner.CreatedDate",
          },
        },
      ],
    });
    expect(Object.isFrozen(query.toOperationNode().groupBy)).toBe(true);
    expect(Object.isFrozen(query.toOperationNode().groupBy?.items)).toBe(true);
  });

  it("selects date functions when their raw date field is grouped", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("CloseDate")
      .select(({ fn }) => [
        fn.calendarYear("CloseDate").as("closeYear"),
        fn.calendarMonth("CloseDate").as("closeMonth"),
      ]);

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly closeYear: number | null;
      readonly closeMonth: number | null;
    }>();
    expect(query.compile().soql).toBe(
      "SELECT COUNT(Id) rowCount, CALENDAR_YEAR(CloseDate) closeYear, CALENDAR_MONTH(CloseDate) closeMonth FROM Account GROUP BY CloseDate",
    );
    expect(() =>
      query.having((eb) =>
        eb(eb.fn.calendarYear("CloseDate") as never, "=", 2026),
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
    expect(() =>
      query.orderBy(({ fn }) => fn.calendarYear("CloseDate") as never),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");

    const rollup = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByRollup("CloseDate");
    expect(() =>
      rollup.select(
        ({ fn }) => fn.calendarYear("CloseDate").as("closeYear") as never,
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
  });

  it("composes convertTimezone with grouped date functions", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.calendarYear(fn.convertTimezone("CreatedDate")))
      .groupBy(({ fn }) =>
        fn.hourInDay(fn.convertTimezone("Owner.CreatedDate")),
      )
      .select(({ fn }) => [
        fn
          .calendarYear(fn.convertTimezone("CreatedDate"))
          .as("localCreatedYear"),
        fn
          .hourInDay(fn.convertTimezone("Owner.CreatedDate"))
          .as("localOwnerCreatedHour"),
      ])
      .having((eb) =>
        eb(
          eb.fn.calendarYear(eb.fn.convertTimezone("CreatedDate")),
          ">=",
          2020,
        ),
      )
      .orderBy(
        ({ fn }) => fn.hourInDay(fn.convertTimezone("Owner.CreatedDate")),
        "desc",
      );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly rowCount: number;
      readonly localCreatedYear: number;
      readonly localOwnerCreatedHour: number | null;
    }>();
    expect(query.toOperationNode().groupBy?.items).toEqual([
      {
        kind: "DateFunctionNode",
        function: "calendarYear",
        reference: {
          kind: "ConvertTimezoneFunctionNode",
          reference: { kind: "ReferenceNode", name: "CreatedDate" },
        },
      },
      {
        kind: "DateFunctionNode",
        function: "hourInDay",
        reference: {
          kind: "ConvertTimezoneFunctionNode",
          reference: {
            kind: "ReferenceNode",
            name: "Owner.CreatedDate",
          },
        },
      },
    ]);
    const firstGrouping = query.toOperationNode().groupBy?.items[0];
    expect(firstGrouping?.kind).toBe("DateFunctionNode");
    if (firstGrouping?.kind !== "DateFunctionNode") {
      throw new Error("Expected a date-function grouping node.");
    }
    expect(Object.isFrozen(firstGrouping.reference)).toBe(true);
  });

  it("keeps converted and UTC date-function grouping identities distinct", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));
    const converted = aggregate.groupBy(({ fn }) =>
      fn.calendarYear(fn.convertTimezone("CreatedDate")),
    );
    const utc = aggregate.groupBy(({ fn }) => fn.calendarYear("CreatedDate"));

    expect(() =>
      converted.select(
        ({ fn }) => fn.calendarYear("CreatedDate").as("utcYear") as never,
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
    expect(() =>
      utc.select(
        ({ fn }) =>
          fn
            .calendarYear(fn.convertTimezone("CreatedDate"))
            .as("localYear") as never,
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
  });

  it("rejects unsupported convertTimezone composition at runtime", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    expect(() =>
      aggregate.groupBy(({ fn }) =>
        fn.calendarYear(fn.convertCurrency("AnnualRevenue") as never),
      ),
    ).toThrow(
      "SOQL date functions require a field reference or an unaliased convertTimezone() expression.",
    );
    expect(() =>
      aggregate.groupBy(({ fn }) =>
        fn.calendarYear(
          fn.convertTimezone(fn.convertTimezone("CreatedDate") as never),
        ),
      ),
    ).toThrow("SOQL convertTimezone() requires a datetime field reference.");
    expect(() =>
      aggregate.select(({ fn }) => fn.convertTimezone("CreatedDate") as never),
    ).toThrow(
      "SOQL aggregate selections must be aliased aggregate function expressions.",
    );
  });

  it("orders grouped results by typed row-producing aggregate functions", () => {
    const grouped = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name");
    const query = grouped
      .orderBy(({ fn }) => fn.countDistinct("Name"), "desc")
      .orderBy(({ fn }) => fn.sum("AnnualRevenue"), undefined, "last")
      .orderBy(({ fn }) => fn.max("Owner.Name"), "asc", "first");

    expect(grouped.toOperationNode().orderBy).toBeUndefined();
    expect(query.toOperationNode().orderBy?.items).toEqual([
      {
        kind: "OrderByItemNode",
        orderBy: {
          kind: "AggregateFunctionNode",
          function: "countDistinct",
          reference: { kind: "ReferenceNode", name: "Name" },
        },
        direction: "desc",
      },
      {
        kind: "OrderByItemNode",
        orderBy: {
          kind: "AggregateFunctionNode",
          function: "sum",
          reference: { kind: "ReferenceNode", name: "AnnualRevenue" },
        },
        nulls: "last",
      },
      {
        kind: "OrderByItemNode",
        orderBy: {
          kind: "AggregateFunctionNode",
          function: "max",
          reference: { kind: "ReferenceNode", name: "Owner.Name" },
        },
        direction: "asc",
        nulls: "first",
      },
    ]);
    expect(Object.isFrozen(query.toOperationNode().orderBy)).toBe(true);
    expect(Object.isFrozen(query.toOperationNode().orderBy?.items)).toBe(true);
  });

  it("rejects invalid aggregate ORDER BY callbacks at runtime", () => {
    const grouped = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name");

    expect(() => grouped.orderBy(({ fn }) => fn.count() as never)).toThrow(
      "SOQL aggregate ORDER BY callbacks must return an unaliased aggregate function with a field argument.",
    );
    expect(() =>
      grouped.orderBy(
        ({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue") as never,
      ),
    ).toThrow(
      "SOQL aggregate ORDER BY callbacks must return an unaliased aggregate function with a field argument.",
    );
  });

  it("rejects date functions outside the matching grouping set at runtime", () => {
    const grouped = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.calendarYear("CloseDate"));

    expect(() =>
      grouped.select(
        ({ fn }) => fn.calendarMonth("CloseDate").as("closeMonth") as never,
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
    expect(() =>
      grouped.having((eb) =>
        eb(eb.fn.calendarMonth("CloseDate") as never, "=", 1),
      ),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
    expect(() =>
      grouped.orderBy(({ fn }) => fn.calendarMonth("CloseDate") as never),
    ).toThrow("SOQL date function expressions must also appear in GROUP BY.");
  });

  it("rejects GROUPING() outside the matching advanced grouping set at runtime", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    expect(() =>
      aggregate
        .groupBy("Name")
        .select(({ fn }) => fn.grouping("Name" as never).as("nameGrouping")),
    ).toThrow(
      "SOQL GROUPING() is available only for fields in GROUP BY ROLLUP or GROUP BY CUBE.",
    );
    expect(() =>
      aggregate
        .groupByRollup("Name")
        .select(({ fn }) =>
          fn.grouping("Active__c" as never).as("activeGrouping"),
        ),
    ).toThrow(
      "SOQL GROUPING() is available only for fields in GROUP BY ROLLUP or GROUP BY CUBE.",
    );
    expect(() =>
      aggregate
        .groupBy("Name")
        .having((eb) => eb(eb.fn.grouping("Name" as never), "=", 1)),
    ).toThrow(
      "SOQL GROUPING() is available only for fields in GROUP BY ROLLUP or GROUP BY CUBE.",
    );
  });

  it("rejects mixed advanced grouping forms and more than three advanced fields at runtime", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    const rollup = aggregate.groupByRollup(["Name", "Active__c"]);
    expect(() =>
      (rollup as unknown as { groupBy(field: string): unknown }).groupBy("Id"),
    ).toThrow(
      "SOQL GROUP BY, GROUP BY ROLLUP, and GROUP BY CUBE forms cannot be mixed.",
    );
    expect(() =>
      (
        rollup as unknown as { groupByCube(field: string): unknown }
      ).groupByCube("Id"),
    ).toThrow(
      "SOQL GROUP BY, GROUP BY ROLLUP, and GROUP BY CUBE forms cannot be mixed.",
    );
    expect(() =>
      (
        rollup as unknown as {
          groupByRollup(fields: string[]): unknown;
        }
      ).groupByRollup(["Id", "Owner.Name"]),
    ).toThrow("SOQL GROUP BY ROLLUP can include at most three fields.");

    const ordinary = aggregate.groupBy("Name");
    expect(() =>
      (
        ordinary as unknown as {
          groupByRollup(field: string): unknown;
        }
      ).groupByRollup("Id"),
    ).toThrow(
      "SOQL GROUP BY, GROUP BY ROLLUP, and GROUP BY CUBE forms cannot be mixed.",
    );
  });

  it("adds immutable typed HAVING conditions after grouping", () => {
    const grouped = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.count("Id").as("rowCount"),
        fn.sum("AnnualRevenue").as("totalRevenue"),
      ])
      .groupBy("Name")
      .select("Name");
    const query = grouped
      .having((eb) =>
        eb.and([
          eb(eb.fn.count("Id"), ">", 1),
          eb.or([
            eb("Name", "like", "Acme%"),
            eb.not(eb(eb.fn.sum("AnnualRevenue"), "<=", 10_000)),
          ]),
        ]),
      )
      .having("Name", "!=", null);

    expect(grouped.toOperationNode().having).toBeUndefined();
    expect(query.toOperationNode().having).toEqual({
      kind: "HavingNode",
      having: {
        kind: "AndNode",
        left: {
          kind: "AndNode",
          left: {
            kind: "BinaryOperationNode",
            leftOperand: {
              kind: "AggregateFunctionNode",
              function: "count",
              reference: { kind: "ReferenceNode", name: "Id" },
            },
            operator: { kind: "OperatorNode", operator: ">" },
            rightOperand: { kind: "ValueNode", value: 1 },
          },
          right: {
            kind: "OrNode",
            left: {
              kind: "BinaryOperationNode",
              leftOperand: { kind: "ReferenceNode", name: "Name" },
              operator: { kind: "OperatorNode", operator: "like" },
              rightOperand: { kind: "ValueNode", value: "Acme%" },
            },
            right: {
              kind: "NotNode",
              operand: {
                kind: "BinaryOperationNode",
                leftOperand: {
                  kind: "AggregateFunctionNode",
                  function: "sum",
                  reference: {
                    kind: "ReferenceNode",
                    name: "AnnualRevenue",
                  },
                },
                operator: { kind: "OperatorNode", operator: "<=" },
                rightOperand: { kind: "ValueNode", value: 10_000 },
              },
            },
          },
        },
        right: {
          kind: "BinaryOperationNode",
          leftOperand: { kind: "ReferenceNode", name: "Name" },
          operator: { kind: "OperatorNode", operator: "!=" },
          rightOperand: { kind: "ValueNode", value: null },
        },
      },
    });
    expect(Object.isFrozen(query.toOperationNode().having)).toBe(true);
    expect(Object.isFrozen(query.toOperationNode().having?.having)).toBe(true);
  });

  it("rejects HAVING before grouping and semi-join operands at runtime", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"));

    expect(() =>
      (
        aggregate as unknown as {
          having(field: string, op: string, value: unknown): unknown;
        }
      ).having("Name", "=", "Acme"),
    ).toThrow("SOQL aggregate queries must use GROUP BY before this clause.");

    const grouped = aggregate.groupBy("OwnerId");
    expect(() =>
      (
        grouped as unknown as {
          having(field: string, op: string, value: unknown): unknown;
        }
      ).having("OwnerId", "in", () => undefined),
    ).toThrow(
      "SOQL semi-joins and anti-joins are only supported in the top-level WHERE clause.",
    );
  });

  it("rejects grouped field selections that are not present in GROUP BY at runtime", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name");

    expect(() =>
      (query as unknown as { select(field: string): unknown }).select(
        "AnnualRevenue",
      ),
    ).toThrow("SOQL aggregate SELECT fields must also appear in GROUP BY.");
  });

  it("keeps scalar WHERE support on aggregate builders", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
      .where("Name", "=", "Acme");

    expect(query.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) totalRevenue FROM Account WHERE Name = 'Acme'",
    );
  });

  it("rejects invalid aliases and duplicate aggregate aliases", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(() =>
      db
        .selectFrom("Account")
        .select(({ fn }) => fn.count("Id").as("bad alias")),
    ).toThrow(
      "SOQL selection aliases must start with a letter or underscore and contain only letters, numbers, and underscores.",
    );
    expect(() =>
      db.selectFrom("Account").select(({ fn }) => fn.count("Id").as("SELECT")),
    ).toThrow("SOQL selection aliases cannot be reserved keywords.");
    expect(() =>
      db
        .selectFrom("Account")
        .select(({ fn }) => [
          fn.count("Id").as("duplicate"),
          fn.max("Name").as("duplicate"),
        ]),
    ).toThrow("Duplicate SOQL aggregate selection alias: duplicate.");
    expect(() =>
      db
        .selectFrom("Account")
        .select(({ fn }) => fn.count("Id").as("duplicate"))
        .select(({ fn }) => fn.max("Name").as("duplicate")),
    ).toThrow("Duplicate SOQL aggregate selection alias: duplicate.");
    expect(() =>
      db
        .selectFrom("Account")
        .select(({ fn }) =>
          fn
            .format(fn.sum("AnnualRevenue").as("totalRevenue") as never)
            .as("formattedRevenue"),
        ),
    ).toThrow(
      "SOQL FORMAT() only supports field references, unaliased convertCurrency() expressions, or unaliased aggregate functions with field arguments.",
    );
  });

  it("models bare COUNT() as a scalar query with WHERE and LIMIT", async () => {
    const executeCountQuery = vi.fn(async () => 42);
    const executeAllCountQuery = vi.fn(async () => 43);
    const executeQuery = vi.fn(async () => []);
    const db = new Kysoql<FixtureSchema>({
      executor: { executeAllCountQuery, executeCountQuery, executeQuery },
    });
    const query = db
      .selectFrom("Account")
      .where("Active__c", "=", true)
      .limit(10)
      .select(({ fn }) => fn.count());

    expect(query.compile().soql).toBe(
      "SELECT COUNT() FROM Account WHERE Active__c = TRUE LIMIT 10",
    );
    expectTypeOf(query.compile()).toMatchTypeOf<{
      readonly soql: string;
    }>();
    await expect(query.execute()).resolves.toBe(42);
    await expect(query.executeAll()).resolves.toBe(43);
    expect(executeCountQuery).toHaveBeenCalledOnce();
    expect(executeAllCountQuery).toHaveBeenCalledOnce();
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it("supports Salesforce QueryAll execution for aggregate result rows", async () => {
    const allCalls: string[] = [];
    const queryCalls: string[] = [];
    const executor: QueryExecutor = {
      async executeAllQuery<O>(
        compiledQuery: CompiledQuery<O>,
      ): Promise<readonly O[]> {
        allCalls.push(compiledQuery.soql);
        return [];
      },
      async executeQuery<O>(
        compiledQuery: CompiledQuery<O>,
      ): Promise<readonly O[]> {
        queryCalls.push(compiledQuery.soql);
        return [];
      },
    };
    const db = new Kysoql<FixtureSchema>({ executor });
    const query = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"));

    await expect(query.executeAll()).resolves.toEqual([]);
    expect(allCalls).toEqual([query.compile().soql]);
    expect(queryCalls).toEqual([]);
  });

  it("reports executors that do not implement bare COUNT() execution", async () => {
    const db = new Kysoql<FixtureSchema>({
      executor: { executeQuery: async () => [] },
    });
    const query = db.selectFrom("Account").select(({ fn }) => fn.count());

    await expect(query.execute()).rejects.toThrow(
      "The configured query executor does not support SOQL COUNT() queries.",
    );
    await expect(query.executeAll()).rejects.toThrow(
      "The configured query executor does not support Salesforce QueryAll COUNT() execution.",
    );
  });

  it("keeps grouped-only clauses unavailable on ungrouped aggregate queries", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(() =>
      db
        .selectFrom("Account")
        .limit(1)
        .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue")),
    ).toThrow(
      "SOQL aggregate queries without GROUP BY cannot use ORDER BY, LIMIT, or OFFSET.",
    );
    expect(() =>
      db
        .selectFrom("Account")
        .orderBy("Name")
        .select(({ fn }) => fn.count()),
    ).toThrow("SOQL COUNT() queries cannot use ORDER BY or OFFSET.");
  });

  it("enforces aggregate field capabilities and selection shapes at compile time", () => {
    const invalidAggregateQueries = () => {
      const db = new Kysoql<FixtureSchema>();

      db.selectFrom("Account").select(({ fn }) => {
        // @ts-expect-error SUM only accepts aggregatable numeric fields.
        return fn.sum("Name").as("invalidSum");
      });

      db.selectFrom("Account").select(({ fn }) => {
        // @ts-expect-error AVG only accepts aggregatable numeric fields.
        return fn.avg("CloseDate").as("invalidAverage");
      });

      db.selectFrom("Account").select(({ fn }) => {
        // @ts-expect-error COUNT(field) requires an aggregatable field.
        return fn.count("Internal_Note__c").as("invalidCount");
      });

      db.selectFrom("Account").select(({ fn }) => {
        // @ts-expect-error GROUPING is available only after ROLLUP or CUBE.
        return fn.grouping("Name").as("invalidGrouping");
      });

      // @ts-expect-error Row-producing aggregate selections require aliases.
      db.selectFrom("Account").select(({ fn }) => fn.sum("AnnualRevenue"));

      db.selectFrom("Account").select(({ fn }) => {
        return (
          fn
            // @ts-expect-error FORMAT cannot wrap an already aliased aggregate selection.
            .format(fn.sum("AnnualRevenue").as("totalRevenue"))
            .as("formattedRevenue")
        );
      });

      db.selectFrom("Account").select(({ fn }) => {
        // @ts-expect-error Bare COUNT() retains its dedicated scalar-query result path.
        return fn.format(fn.count()).as("formattedCount");
      });

      const scalarQuery = db.selectFrom("Account").select("Id");
      // @ts-expect-error Aggregate mode cannot begin after record selections.
      scalarQuery.select(({ fn }) => fn.count("Id").as("rowCount"));

      const aggregateQuery = db
        .selectFrom("Account")
        .select(({ fn }) => fn.count("Id").as("rowCount"));
      // @ts-expect-error Grouped record fields require an explicit GROUP BY first.
      aggregateQuery.select("Name");

      // @ts-expect-error GROUP BY requires a generated groupable field.
      aggregateQuery.groupBy("Internal_Note__c");

      // @ts-expect-error LIMIT is available only after GROUP BY.
      aggregateQuery.limit(1);

      // @ts-expect-error ORDER BY is available only after GROUP BY.
      aggregateQuery.orderBy("Name");
      // @ts-expect-error Aggregate expression ORDER BY is available only after GROUP BY.
      aggregateQuery.orderBy(({ fn }) => fn.count("Id"));

      // @ts-expect-error HAVING is available only after GROUP BY.
      aggregateQuery.having((eb) => eb(eb.fn.count("Id"), ">", 1));

      const groupedQuery = aggregateQuery.groupBy("Name");
      groupedQuery.having("Name", "like", "Acme%");
      groupedQuery.having((eb) => eb(eb.fn.count("Id"), ">", 1));
      // @ts-expect-error Non-aggregate selected fields must be grouped.
      groupedQuery.select("AnnualRevenue");
      // @ts-expect-error Aggregate ORDER BY fields must be grouped in this slice.
      groupedQuery.orderBy("AnnualRevenue");
      // @ts-expect-error HAVING field references must be grouped.
      groupedQuery.having("AnnualRevenue", ">", 1);
      groupedQuery.having((eb) => {
        // @ts-expect-error COUNT() HAVING comparisons require numeric values.
        return eb(eb.fn.count("Id"), ">", "1");
      });
      groupedQuery.having((eb) => {
        // @ts-expect-error MAX(date) does not support LIKE comparisons.
        return eb(eb.fn.max("CloseDate"), "like", "2026%");
      });
      groupedQuery.select(({ fn }) => {
        // @ts-expect-error Ordinary GROUP BY does not expose GROUPING.
        return fn.grouping("Name").as("invalidGrouping");
      });
      // @ts-expect-error Ordinary GROUP BY cannot order by GROUPING.
      groupedQuery.orderBy(({ fn }) => fn.grouping("Name"));
      groupedQuery.orderBy(({ fn }) => fn.count("Id"), "desc");
      groupedQuery.orderBy(
        ({ fn }) => fn.sum("AnnualRevenue"),
        undefined,
        "last",
      );
      // @ts-expect-error Bare COUNT() cannot be used in ORDER BY.
      groupedQuery.orderBy(({ fn }) => fn.count());
      // @ts-expect-error Aggregate ORDER BY expressions must be unaliased.
      groupedQuery.orderBy(({ fn }) => {
        return fn.sum("AnnualRevenue").as("totalRevenue");
      });
      groupedQuery.orderBy(({ fn }) => {
        // @ts-expect-error Aggregate ORDER BY preserves aggregatable metadata.
        return fn.count("Internal_Note__c");
      });
      groupedQuery.orderBy(({ fn }) => {
        // @ts-expect-error Aggregate ORDER BY preserves numeric field requirements.
        return fn.avg("Name");
      });

      const dateGroupedQuery = aggregateQuery
        .groupBy(({ fn }) => fn.calendarYear("CloseDate"))
        .groupBy(({ fn }) => fn.dayOnly("CreatedDate"));
      dateGroupedQuery.select(({ fn }) =>
        fn.calendarYear("CloseDate").as("closeYear"),
      );
      dateGroupedQuery.having((eb) =>
        eb(eb.fn.calendarYear("CloseDate"), ">", 2020),
      );
      dateGroupedQuery.orderBy(({ fn }) => fn.dayOnly("CreatedDate"));
      // @ts-expect-error Selected date functions must be exact GROUP BY members.
      dateGroupedQuery.select(({ fn }) => {
        return fn.calendarMonth("CloseDate").as("closeMonth");
      });
      dateGroupedQuery.having((eb) => {
        // @ts-expect-error HAVING date functions must be exact GROUP BY members.
        return eb(eb.fn.calendarMonth("CloseDate"), "=", 1);
      });
      // @ts-expect-error ORDER BY date functions must be exact GROUP BY members.
      dateGroupedQuery.orderBy(({ fn }) => fn.calendarMonth("CloseDate"));

      const rawDateGroupedQuery = aggregateQuery.groupBy("CloseDate");
      rawDateGroupedQuery.select(({ fn }) => [
        fn.calendarYear("CloseDate").as("closeYear"),
        fn.calendarMonth("CloseDate").as("closeMonth"),
      ]);
      rawDateGroupedQuery.having((eb) => {
        // @ts-expect-error HAVING still requires exact date-function grouping.
        return eb(eb.fn.calendarYear("CloseDate"), "=", 2026);
      });
      // @ts-expect-error ORDER BY still requires exact date-function grouping.
      rawDateGroupedQuery.orderBy(({ fn }) => fn.calendarYear("CloseDate"));

      const rawDatetimeGroupedQuery = aggregateQuery.groupBy("CreatedDate");
      // @ts-expect-error The raw-field GROUP BY exception applies to date fields, not datetime fields.
      rawDatetimeGroupedQuery.select(({ fn }) => {
        return fn.calendarYear("CreatedDate").as("createdYear");
      });

      const rollupDateGroupedQuery = aggregateQuery.groupByRollup("CloseDate");
      // @ts-expect-error The raw-date-field exception is scoped to ordinary GROUP BY.
      rollupDateGroupedQuery.select(({ fn }) => {
        return fn.calendarYear("CloseDate").as("closeYear");
      });

      const timezoneGroupedQuery = aggregateQuery.groupBy(({ fn }) =>
        fn.calendarYear(fn.convertTimezone("CreatedDate")),
      );
      timezoneGroupedQuery.select(({ fn }) =>
        fn.calendarYear(fn.convertTimezone("CreatedDate")).as("localYear"),
      );
      timezoneGroupedQuery.having((eb) =>
        eb(eb.fn.calendarYear(eb.fn.convertTimezone("CreatedDate")), "=", 2026),
      );
      timezoneGroupedQuery.orderBy(({ fn }) =>
        fn.calendarYear(fn.convertTimezone("CreatedDate")),
      );
      // @ts-expect-error Converted and UTC date-function identities are distinct.
      timezoneGroupedQuery.select(({ fn }) => {
        return fn.calendarYear("CreatedDate").as("utcYear");
      });
      timezoneGroupedQuery.having((eb) => {
        // @ts-expect-error Converted and UTC HAVING identities are distinct.
        return eb(eb.fn.calendarYear("CreatedDate"), "=", 2026);
      });
      // @ts-expect-error Converted and UTC ORDER BY identities are distinct.
      timezoneGroupedQuery.orderBy(({ fn }) => {
        return fn.calendarYear("CreatedDate");
      });

      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error Date grouping functions require date or datetime fields.
        return fn.calendarYear("Name");
      });
      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error DAY_ONLY accepts only datetime fields.
        return fn.dayOnly("CloseDate");
      });
      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error HOUR_IN_DAY accepts only datetime fields.
        return fn.hourInDay("CloseDate");
      });
      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error convertTimezone accepts only datetime fields.
        return fn.calendarYear(fn.convertTimezone("CloseDate"));
      });
      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error convertTimezone accepts only generated field references.
        return fn.calendarYear(fn.convertTimezone("Does_Not_Exist__c"));
      });
      aggregateQuery.groupBy(({ fn }) => {
        return fn.calendarYear(
          // @ts-expect-error convertTimezone cannot be nested inside itself.
          fn.convertTimezone(fn.convertTimezone("CreatedDate")),
        );
      });
      aggregateQuery.groupBy(({ fn }) => {
        // @ts-expect-error Date functions accept only fields or convertTimezone expressions.
        return fn.calendarYear(fn.convertCurrency("AnnualRevenue"));
      });
      // @ts-expect-error convertTimezone is an intermediate expression, not a standalone selection.
      db.selectFrom("Account").select(({ fn }) =>
        fn.convertTimezone("CreatedDate"),
      );
      // @ts-expect-error Date function grouping cannot be mixed with ROLLUP.
      dateGroupedQuery.groupByRollup("Name");

      const ownerGroupedQuery = aggregateQuery.groupBy("OwnerId");
      // @ts-expect-error HAVING IN operands cannot be semi-join callbacks.
      ownerGroupedQuery.having("OwnerId", "in", () => undefined);

      const rollupQuery = aggregateQuery
        .groupByRollup(["Name", "Active__c"])
        .groupByRollup("Owner.Name");
      rollupQuery.select(["Name", "Active__c", "Owner.Name"]);
      rollupQuery.having((eb) => eb(eb.fn.count("Id"), ">", 1));
      rollupQuery.having((eb) => eb(eb.fn.grouping("Name"), "=", 1));
      rollupQuery.select(({ fn }) => fn.grouping("Name").as("nameGrouping"));
      // @ts-expect-error FORMAT supports row-producing aggregates, not GROUPING indicators.
      rollupQuery.select(({ fn }) => {
        // @ts-expect-error FORMAT supports row-producing aggregates, not GROUPING indicators.
        return fn.format(fn.grouping("Name")).as("formattedGrouping");
      });
      rollupQuery.orderBy(({ fn }) => fn.grouping("Name"));
      rollupQuery.orderBy("Name");
      rollupQuery.limit(10);
      rollupQuery.select(({ fn }) => {
        // @ts-expect-error GROUPING must reference an accumulated ROLLUP field.
        return fn.grouping("AnnualRevenue").as("invalidGrouping");
      });
      rollupQuery.having((eb) => {
        // @ts-expect-error GROUPING comparisons accept only the 0 | 1 indicators.
        return eb(eb.fn.grouping("Name"), "=", 2);
      });
      rollupQuery.orderBy(({ fn }) => fn.count("Id"));
      // @ts-expect-error ROLLUP supports at most three grouping fields.
      rollupQuery.groupByRollup("Id");
      // @ts-expect-error Ordinary GROUP BY cannot be mixed with ROLLUP.
      rollupQuery.groupBy("Id");
      // @ts-expect-error CUBE cannot be mixed with ROLLUP.
      rollupQuery.groupByCube("Id");
      // @ts-expect-error Date function grouping cannot be mixed with ROLLUP.
      rollupQuery.groupBy(({ fn }) => fn.calendarYear("CloseDate"));

      // @ts-expect-error ROLLUP field lists can contain at most three fields.
      aggregateQuery.groupByRollup(["Name", "Active__c", "Id", "Owner.Name"]);
      // @ts-expect-error ROLLUP cannot group fields that are not groupable.
      aggregateQuery.groupByRollup("Internal_Note__c");
      // @ts-expect-error ROLLUP requires at least one field.
      aggregateQuery.groupByRollup([]);

      const cubeQuery = aggregateQuery
        .groupByCube("Name")
        .groupByCube(["Active__c", "Owner.Name"]);
      cubeQuery.select(["Name", "Active__c", "Owner.Name"]);
      // @ts-expect-error CUBE supports at most three grouping fields.
      cubeQuery.groupByCube("Id");
      // @ts-expect-error Ordinary GROUP BY cannot be mixed with CUBE.
      cubeQuery.groupBy("Id");
      // @ts-expect-error ROLLUP cannot be mixed with CUBE.
      cubeQuery.groupByRollup("Id");

      const relationshipGroupedQuery = aggregateQuery.groupBy("Owner.Name");
      relationshipGroupedQuery.select("Owner.Name");

      const countQuery = db
        .selectFrom("Account")
        .select(({ fn }) => fn.count());
      // @ts-expect-error Bare COUNT() does not expose ORDER BY.
      countQuery.orderBy("Name");
      // @ts-expect-error Bare COUNT() does not expose OFFSET.
      countQuery.offset(1);
    };

    expect(invalidAggregateQueries).toBeTypeOf("function");
  });
});
