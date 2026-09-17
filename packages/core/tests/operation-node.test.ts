import { describe, expect, it } from "vitest";

import { AndNode } from "#/operation-node/and-node";
import {
  BinaryOperationNode,
} from "#/operation-node/binary-operation-node";
import { LimitNode } from "#/operation-node/limit-node";
import { OperatorNode } from "#/operation-node/operator-node";
import { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { OrderByNode } from "#/operation-node/order-by-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
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

  it("creates frozen binary and AND operation nodes", () => {
    const left = ReferenceNode.create("Name");
    const operator = OperatorNode.create("=");
    const right = ValueNode.create("Acme");
    const binary = BinaryOperationNode.create(left, operator, right);
    const and = AndNode.create(binary, binary);

    expect(binary).toEqual({
      kind: "BinaryOperationNode",
      leftOperand: left,
      operator,
      rightOperand: right,
    });
    expect(and).toEqual({ kind: "AndNode", left: binary, right: binary });
    expectFrozen(binary);
    expectFrozen(and);
  });

  it("creates frozen LIMIT nodes", () => {
    const limit = LimitNode.create(25);

    expect(limit).toEqual({ kind: "LimitNode", limit: 25 });
    expectFrozen(limit);
  });

  it("creates order items with and without explicit directions", () => {
    const reference = ReferenceNode.create("Name");
    const implicit = OrderByItemNode.create(reference);
    const explicit = OrderByItemNode.create(reference, "desc");

    expect(implicit).toEqual({ kind: "OrderByItemNode", orderBy: reference });
    expect(explicit).toEqual({
      kind: "OrderByItemNode",
      orderBy: reference,
      direction: "desc",
    });
    expect("direction" in implicit).toBe(false);
    expectFrozen(implicit);
    expectFrozen(explicit);
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
});
