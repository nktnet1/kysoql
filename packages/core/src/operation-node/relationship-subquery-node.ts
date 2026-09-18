import type { LimitNode } from "#/operation-node/limit-node";
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

  cloneWithLimit(
    subquery: RelationshipSubqueryNode,
    limit: LimitNode,
  ): RelationshipSubqueryNode {
    return freeze({
      ...subquery,
      limit,
    });
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
};
