import type { LimitNode } from "#/operation-node/limit-node";
import type { OffsetNode } from "#/operation-node/offset-node";
import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { OrderByNode } from "#/operation-node/order-by-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { WhereNode } from "#/operation-node/where-node";
import { freeze } from "#/util/object-utils";

export interface RelationshipSubqueryNode {
  readonly kind: "RelationshipSubqueryNode";
  readonly relationship: ReferenceNode;
  readonly selections?: ReadonlyArray<SelectionNode>;
  readonly where?: WhereNode;
  readonly orderBy?: OrderByNode;
  readonly limit?: LimitNode;
  readonly offset?: OffsetNode;
}

export const RelationshipSubqueryNode = {
  create(relationship: ReferenceNode): RelationshipSubqueryNode {
    return freeze({
      kind: "RelationshipSubqueryNode",
      relationship,
    });
  },

  cloneWithSelections(
    subquery: RelationshipSubqueryNode,
    selections: ReadonlyArray<SelectionNode>,
  ): RelationshipSubqueryNode {
    return freeze({
      ...subquery,
      selections: subquery.selections
        ? freeze([...subquery.selections, ...selections])
        : freeze([...selections]),
    });
  },

  cloneWithoutSelections(
    subquery: RelationshipSubqueryNode,
  ): RelationshipSubqueryNode {
    const { selections: _selections, ...withoutSelections } = subquery;

    return freeze(withoutSelections);
  },

  cloneWithLimit(
    subquery: RelationshipSubqueryNode,
    limit: LimitNode,
  ): RelationshipSubqueryNode {
    return freeze({
      ...subquery,
      limit,
    });
  },

  cloneWithoutLimit(
    subquery: RelationshipSubqueryNode,
  ): RelationshipSubqueryNode {
    const { limit: _limit, ...withoutLimit } = subquery;

    return freeze(withoutLimit);
  },

  cloneWithOffset(
    subquery: RelationshipSubqueryNode,
    offset: OffsetNode,
  ): RelationshipSubqueryNode {
    return freeze({
      ...subquery,
      offset,
    });
  },

  cloneWithoutOffset(
    subquery: RelationshipSubqueryNode,
  ): RelationshipSubqueryNode {
    const { offset: _offset, ...withoutOffset } = subquery;

    return freeze(withoutOffset);
  },

  cloneWithOrderByItems(
    subquery: RelationshipSubqueryNode,
    items: ReadonlyArray<OrderByItemNode>,
  ): RelationshipSubqueryNode {
    return freeze({
      ...subquery,
      orderBy: subquery.orderBy
        ? OrderByNode.cloneWithItems(subquery.orderBy, items)
        : OrderByNode.create(items),
    });
  },

  cloneWithoutOrderBy(
    subquery: RelationshipSubqueryNode,
  ): RelationshipSubqueryNode {
    const { orderBy: _orderBy, ...withoutOrderBy } = subquery;

    return freeze(withoutOrderBy);
  },
};
