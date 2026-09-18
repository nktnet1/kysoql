import { freeze } from "#/util/object-utils";
import {
  type AdvancedGroupByMode,
  GroupByNode,
} from "#/operation-node/group-by-node";
import { HavingNode } from "#/operation-node/having-node";
import type { LimitNode } from "#/operation-node/limit-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { OffsetNode } from "#/operation-node/offset-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { OrderByNode } from "#/operation-node/order-by-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { SObjectNode } from "#/operation-node/sobject-node";
import type { WhereNode } from "#/operation-node/where-node";

export interface SelectQueryNode {
  readonly kind: "SelectQueryNode";
  readonly from: SObjectNode;
  readonly selections?: ReadonlyArray<SelectionNode>;
  readonly where?: WhereNode;
  readonly groupBy?: GroupByNode;
  readonly having?: HavingNode;
  readonly orderBy?: OrderByNode;
  readonly limit?: LimitNode;
  readonly offset?: OffsetNode;
}

export const SelectQueryNode = {
  createFrom(from: SObjectNode): SelectQueryNode {
    return freeze({
      kind: "SelectQueryNode",
      from,
    });
  },

  cloneWithSelections(
    select: SelectQueryNode,
    selections: ReadonlyArray<SelectionNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      selections: select.selections
        ? freeze([...select.selections, ...selections])
        : freeze([...selections]),
    });
  },

  cloneWithGroupByItems(
    select: SelectQueryNode,
    items: ReadonlyArray<ReferenceNode>,
    mode?: AdvancedGroupByMode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      groupBy: select.groupBy
        ? GroupByNode.cloneWithItems(select.groupBy, items, mode)
        : GroupByNode.create(items, mode),
    });
  },

  cloneWithHaving(
    select: SelectQueryNode,
    operation: OperationNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      having: select.having
        ? HavingNode.cloneWithOperation(select.having, operation)
        : HavingNode.create(operation),
    });
  },

  cloneWithLimit(select: SelectQueryNode, limit: LimitNode): SelectQueryNode {
    return freeze({
      ...select,
      limit,
    });
  },

  cloneWithOffset(select: SelectQueryNode, offset: OffsetNode): SelectQueryNode {
    return freeze({
      ...select,
      offset,
    });
  },

  cloneWithOrderByItems(
    select: SelectQueryNode,
    items: ReadonlyArray<OrderByItemNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      orderBy: select.orderBy
        ? OrderByNode.cloneWithItems(select.orderBy, items)
        : OrderByNode.create(items),
    });
  },
};
