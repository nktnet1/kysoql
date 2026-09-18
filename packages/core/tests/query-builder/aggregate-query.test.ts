import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { Kysoql } from "#/kysoql";
import type { AggregateSelectQueryBuilder } from "#/query-builder/aggregate-select-query-builder";
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
  readonly Account: SalesforceObject<{
    readonly Id: AggregatableField<string, "id", false>;
    readonly Name: AggregatableField<string, "string", true>;
    readonly AnnualRevenue: AggregatableField<number, "currency", true>;
    readonly EmployeeCount__c: AggregatableField<number, "int", true>;
    readonly CloseDate: AggregatableField<string, "date", true>;
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
  }, {
    readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
  }>;
  readonly User: SalesforceObject<{
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

  it(
    "rejects mixed advanced grouping forms and more than three advanced fields at runtime",
    () => {
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
    },
  );

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
      db
        .selectFrom("Account")
        .select(({ fn }) => fn.count("Id").as("SELECT")),
    ).toThrow("SOQL selection aliases cannot be reserved keywords.");
    expect(() =>
      db.selectFrom("Account").select(({ fn }) => [
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
  });

  it("models bare COUNT() as a scalar query with WHERE and LIMIT", async () => {
    const executeCountQuery = vi.fn(async () => 42);
    const executeQuery = vi.fn(async () => []);
    const db = new Kysoql<FixtureSchema>({
      executor: { executeCountQuery, executeQuery },
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
    expect(executeCountQuery).toHaveBeenCalledOnce();
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it("reports executors that do not implement bare COUNT() execution", async () => {
    const db = new Kysoql<FixtureSchema>({
      executor: { executeQuery: async () => [] },
    });
    const query = db.selectFrom("Account").select(({ fn }) => fn.count());

    await expect(query.execute()).rejects.toThrow(
      "The configured query executor does not support SOQL COUNT() queries.",
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

      // @ts-expect-error Row-producing aggregate selections require aliases.
      db.selectFrom("Account").select(({ fn }) => fn.sum("AnnualRevenue"));

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

      const ownerGroupedQuery = aggregateQuery.groupBy("OwnerId");
      // @ts-expect-error HAVING IN operands cannot be semi-join callbacks.
      ownerGroupedQuery.having("OwnerId", "in", () => undefined);

      const rollupQuery = aggregateQuery
        .groupByRollup(["Name", "Active__c"])
        .groupByRollup("Owner.Name");
      rollupQuery.select(["Name", "Active__c", "Owner.Name"]);
      rollupQuery.having((eb) => eb(eb.fn.count("Id"), ">", 1));
      rollupQuery.orderBy("Name");
      rollupQuery.limit(10);
      // @ts-expect-error ROLLUP supports at most three grouping fields.
      rollupQuery.groupByRollup("Id");
      // @ts-expect-error Ordinary GROUP BY cannot be mixed with ROLLUP.
      rollupQuery.groupBy("Id");
      // @ts-expect-error CUBE cannot be mixed with ROLLUP.
      rollupQuery.groupByCube("Id");

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
