import { describe, expect, it } from "vitest";

import { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import { AliasNode } from "#/operation-node/alias-node";
import { AndNode } from "#/operation-node/and-node";
import {
  BinaryOperationNode,
} from "#/operation-node/binary-operation-node";
import { GroupByNode } from "#/operation-node/group-by-node";
import { HavingNode } from "#/operation-node/having-node";
import { LimitNode } from "#/operation-node/limit-node";
import { OffsetNode } from "#/operation-node/offset-node";
import { NotNode } from "#/operation-node/not-node";
import { OrNode } from "#/operation-node/or-node";
import { OperatorNode } from "#/operation-node/operator-node";
import { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { OrderByNode } from "#/operation-node/order-by-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { ValueListNode } from "#/operation-node/value-list-node";
import { ValueNode } from "#/operation-node/value-node";
import { WhereNode } from "#/operation-node/where-node";

const expectFrozen = (value: object): void => {
  expect(Object.isFrozen(value)).toBe(true);
};

describe("operation nodes", () => {
  it("creates frozen scalar nodes", () => {
    const reference = ReferenceNode.create("Name");
    const operator = OperatorNode.create("like");
    const value = ValueNode.create("Acme%");
    const sobject = SObjectNode.create("Account");
    const selection = SelectionNode.create(reference);

    expect(reference).toEqual({ kind: "ReferenceNode", name: "Name" });
    expect(operator).toEqual({ kind: "OperatorNode", operator: "like" });
    expect(value).toEqual({ kind: "ValueNode", value: "Acme%" });
    expect(sobject).toEqual({ kind: "SObjectNode", name: "Account" });
    expect(selection).toEqual({ kind: "SelectionNode", selection: reference });
    for (const node of [reference, operator, value, sobject, selection]) {
      expectFrozen(node);
    }
  });

  it("creates frozen aggregate function and alias nodes", () => {
    const reference = ReferenceNode.create("AnnualRevenue");
    const aggregate = AggregateFunctionNode.create("sum", reference);
    const alias = AliasNode.create(aggregate, "totalRevenue");
    const selection = SelectionNode.create(alias);

    expect(aggregate).toEqual({
      kind: "AggregateFunctionNode",
      function: "sum",
      reference,
    });
    expect(alias).toEqual({
      kind: "AliasNode",
      node: aggregate,
      alias: "totalRevenue",
    });
    expect(selection).toEqual({ kind: "SelectionNode", selection: alias });
    expectFrozen(aggregate);
    expectFrozen(alias);
    expectFrozen(selection);
  });

  it("creates frozen value-list nodes and members", () => {
    const list = ValueListNode.create(["Acme", 100]);

    expect(list).toEqual({
      kind: "ValueListNode",
      values: [
        { kind: "ValueNode", value: "Acme" },
        { kind: "ValueNode", value: 100 },
      ],
    });
    expectFrozen(list);
    expectFrozen(list.values);
    for (const value of list.values) {
      expectFrozen(value);
    }
  });

  it("creates frozen binary, AND, OR, and NOT operation nodes", () => {
    const left = ReferenceNode.create("Name");
    const operator = OperatorNode.create("=");
    const right = ValueNode.create("Acme");
    const binary = BinaryOperationNode.create(left, operator, right);
    const and = AndNode.create(binary, binary);
    const or = OrNode.create(binary, binary);
    const not = NotNode.create(or);

    expect(binary).toEqual({
      kind: "BinaryOperationNode",
      leftOperand: left,
      operator,
      rightOperand: right,
    });
    expect(and).toEqual({ kind: "AndNode", left: binary, right: binary });
    expect(or).toEqual({ kind: "OrNode", left: binary, right: binary });
    expect(not).toEqual({ kind: "NotNode", operand: or });
    expectFrozen(binary);
    expectFrozen(and);
    expectFrozen(or);
    expectFrozen(not);
  });

  it("creates frozen LIMIT and OFFSET nodes", () => {
    const limit = LimitNode.create(25);
    const offset = OffsetNode.create(10);

    expect(limit).toEqual({ kind: "LimitNode", limit: 25 });
    expect(offset).toEqual({ kind: "OffsetNode", offset: 10 });
    expectFrozen(limit);
    expectFrozen(offset);
  });

  it("creates order items with optional direction and null placement", () => {
    const reference = ReferenceNode.create("Name");
    const implicit = OrderByItemNode.create(reference);
    const explicit = OrderByItemNode.create(reference, "desc", "last");

    expect(implicit).toEqual({ kind: "OrderByItemNode", orderBy: reference });
    expect(explicit).toEqual({
      kind: "OrderByItemNode",
      orderBy: reference,
      direction: "desc",
      nulls: "last",
    });
    expect("direction" in implicit).toBe(false);
    expect("nulls" in implicit).toBe(false);
    expectFrozen(implicit);
    expectFrozen(explicit);
  });

  it("creates and extends immutable GROUP BY lists", () => {
    const first = ReferenceNode.create("Name");
    const second = ReferenceNode.create("Owner.Name");
    const initial = GroupByNode.create([first]);
    const extended = GroupByNode.cloneWithItems(initial, [second]);

    expect(initial.items).toEqual([first]);
    expect(extended.items).toEqual([first, second]);
    expect(initial).not.toBe(extended);
    expectFrozen(initial);
    expectFrozen(initial.items);
    expectFrozen(extended);
    expectFrozen(extended.items);
  });

  it("creates and extends immutable advanced GROUP BY modes", () => {
    const first = ReferenceNode.create("Name");
    const second = ReferenceNode.create("Owner.Name");
    const rollup = GroupByNode.create([first], "rollup");
    const extended = GroupByNode.cloneWithItems(rollup, [second], "rollup");
    const cube = GroupByNode.create([first, second], "cube");

    expect(rollup).toEqual({
      kind: "GroupByNode",
      items: [first],
      mode: "rollup",
    });
    expect(extended).toEqual({
      kind: "GroupByNode",
      items: [first, second],
      mode: "rollup",
    });
    expect(cube.mode).toBe("cube");
    expect(() =>
      GroupByNode.cloneWithItems(rollup, [second], "cube"),
    ).toThrow(
      "SOQL GROUP BY, GROUP BY ROLLUP, and GROUP BY CUBE forms cannot be mixed.",
    );
    expectFrozen(rollup);
    expectFrozen(rollup.items);
    expectFrozen(extended);
    expectFrozen(extended.items);
    expectFrozen(cube);
  });

  it("creates and extends immutable HAVING trees", () => {
    const first = BinaryOperationNode.create(
      AggregateFunctionNode.create("count", ReferenceNode.create("Id")),
      OperatorNode.create(">"),
      ValueNode.create(1),
    );
    const second = BinaryOperationNode.create(
      ReferenceNode.create("Name"),
      OperatorNode.create("!="),
      ValueNode.create(null),
    );
    const initial = HavingNode.create(first);
    const extended = HavingNode.cloneWithOperation(initial, second);

    expect(initial.having).toBe(first);
    expect(extended.having).toEqual(AndNode.create(first, second));
    expect(initial).not.toBe(extended);
    expectFrozen(initial);
    expectFrozen(extended);
    expectFrozen(extended.having);
  });

  it("creates and extends immutable ORDER BY lists", () => {
    const first = OrderByItemNode.create(ReferenceNode.create("Name"), "asc");
    const second = OrderByItemNode.create(ReferenceNode.create("Id"), "desc");
    const initial = OrderByNode.create([first]);
    const extended = OrderByNode.cloneWithItems(initial, [second]);

    expect(initial.items).toEqual([first]);
    expect(extended.items).toEqual([first, second]);
    expect(initial).not.toBe(extended);
    expectFrozen(initial);
    expectFrozen(initial.items);
    expectFrozen(extended);
    expectFrozen(extended.items);
  });

  it("creates and extends immutable WHERE trees", () => {
    const first = BinaryOperationNode.create(
      ReferenceNode.create("Name"),
      OperatorNode.create("="),
      ValueNode.create("Acme"),
    );
    const second = BinaryOperationNode.create(
      ReferenceNode.create("Id"),
      OperatorNode.create("!="),
      ValueNode.create(null),
    );
    const initial = WhereNode.create(first);
    const extended = WhereNode.cloneWithOperation(initial, second);

    expect(initial.where).toBe(first);
    expect(extended.where).toEqual(AndNode.create(first, second));
    expect(initial).not.toBe(extended);
    expectFrozen(initial);
    expectFrozen(extended);
    expectFrozen(extended.where);
  });

  it(
    "adds a new WHERE node or extends an existing WHERE node through QueryNode",
    () => {
      const base = SelectQueryNode.createFrom(SObjectNode.create("Account"));
      const first = ValueNode.create(true);
      const withWhere = QueryNode.cloneWithWhere(base, first);
      const second = ValueNode.create(false);
      const withAnd = QueryNode.cloneWithWhere(withWhere, second);

      expect(base.where).toBeUndefined();
      expect(withWhere.where).toEqual(WhereNode.create(first));
      expect(withAnd.where?.where).toEqual(AndNode.create(first, second));
      expectFrozen(withWhere);
      expectFrozen(withAnd);
    },
  );

  it("sets and replaces immutable SELECT limits", () => {
    const base = SelectQueryNode.createFrom(SObjectNode.create("Account"));
    const firstLimit = LimitNode.create(25);
    const secondLimit = LimitNode.create(0);
    const limited = SelectQueryNode.cloneWithLimit(base, firstLimit);
    const relimited = SelectQueryNode.cloneWithLimit(limited, secondLimit);

    expect(base.limit).toBeUndefined();
    expect(limited.limit).toBe(firstLimit);
    expect(relimited.limit).toBe(secondLimit);
    expect(limited).not.toBe(relimited);
    expectFrozen(limited);
    expectFrozen(relimited);
  });

  it(
    "creates and extends immutable SELECT selection and ORDER BY lists",
    () => {
      const base = SelectQueryNode.createFrom(SObjectNode.create("Account"));
      const id = SelectionNode.create(ReferenceNode.create("Id"));
      const name = SelectionNode.create(ReferenceNode.create("Name"));
      const withId = SelectQueryNode.cloneWithSelections(base, [id]);
      const withName = SelectQueryNode.cloneWithSelections(withId, [name]);
      const firstOrder = OrderByItemNode.create(ReferenceNode.create("Name"));
      const secondOrder = OrderByItemNode.create(
        ReferenceNode.create("Id"),
        "desc",
      );
      const ordered = SelectQueryNode.cloneWithOrderByItems(withName, [
        firstOrder,
      ]);
      const reordered = SelectQueryNode.cloneWithOrderByItems(ordered, [
        secondOrder,
      ]);

      expect(base.selections).toBeUndefined();
      expect(withId.selections).toEqual([id]);
      expect(withName.selections).toEqual([id, name]);
      expect(ordered.orderBy?.items).toEqual([firstOrder]);
      expect(reordered.orderBy?.items).toEqual([firstOrder, secondOrder]);
      expectFrozen(withId.selections as readonly object[]);
      expectFrozen(withName.selections as readonly object[]);
      expectFrozen(ordered.orderBy as object);
      expectFrozen(reordered.orderBy as object);
    },
  );

  it("creates and selects immutable semi-join subqueries", () => {
    const base = SemiJoinSubqueryNode.createFrom(
      SObjectNode.create("Opportunity"),
    );
    const selected = SemiJoinSubqueryNode.cloneWithSelection(
      base,
      ReferenceNode.create("AccountId"),
    );
    const filtered = QueryNode.cloneWithWhere(
      selected,
      BinaryOperationNode.create(
        ReferenceNode.create("StageName"),
        OperatorNode.create("="),
        ValueNode.create("Closed Won"),
      ),
    );

    expect(base).toEqual({
      kind: "SemiJoinSubqueryNode",
      from: { kind: "SObjectNode", name: "Opportunity" },
    });
    expect(selected.selection).toEqual({
      kind: "ReferenceNode",
      name: "AccountId",
    });
    expect(filtered.where?.where).toEqual({
      kind: "BinaryOperationNode",
      leftOperand: { kind: "ReferenceNode", name: "StageName" },
      operator: { kind: "OperatorNode", operator: "=" },
      rightOperand: { kind: "ValueNode", value: "Closed Won" },
    });
    expect(base.selection).toBeUndefined();
    expect(base.where).toBeUndefined();
    expectFrozen(base);
    expectFrozen(selected);
    expectFrozen(filtered);
  });

  it("creates and extends immutable relationship subqueries", () => {
    const base = RelationshipSubqueryNode.create(
      ReferenceNode.create("Contacts"),
    );
    const id = SelectionNode.create(ReferenceNode.create("Id"));
    const selected = RelationshipSubqueryNode.cloneWithSelections(base, [id]);
    const limited = RelationshipSubqueryNode.cloneWithLimit(
      selected,
      LimitNode.create(5),
    );
    const ordered = RelationshipSubqueryNode.cloneWithOrderByItems(limited, [
      OrderByItemNode.create(ReferenceNode.create("LastName"), "asc"),
    ]);

    expect(base).toEqual({
      kind: "RelationshipSubqueryNode",
      relationship: { kind: "ReferenceNode", name: "Contacts" },
    });
    expect(selected.selections).toEqual([id]);
    expect(limited.limit).toEqual({ kind: "LimitNode", limit: 5 });
    expect(ordered.orderBy?.items).toEqual([
      {
        kind: "OrderByItemNode",
        orderBy: { kind: "ReferenceNode", name: "LastName" },
        direction: "asc",
      },
    ]);
    expect(base.selections).toBeUndefined();
    expectFrozen(base);
    expectFrozen(selected);
    expectFrozen(selected.selections as readonly object[]);
    expectFrozen(limited);
    expectFrozen(ordered);
  });
});
