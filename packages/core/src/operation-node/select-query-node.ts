import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import {
  type AdvancedGroupByMode,
  GroupByNode,
} from "#/operation-node/group-by-node";
import { HavingNode } from "#/operation-node/having-node";
import {
  type KnowledgeUpdateMode,
  KnowledgeUpdateNode,
} from "#/operation-node/knowledge-update-node";
import type { LimitNode } from "#/operation-node/limit-node";
import type { OffsetNode } from "#/operation-node/offset-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { OrderByNode } from "#/operation-node/order-by-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { SObjectNode } from "#/operation-node/sobject-node";
import type { UsingScopeNode } from "#/operation-node/using-scope-node";
import type { WhereNode } from "#/operation-node/where-node";
import {
  type DataCategorySelectionNode,
  WithDataCategoryNode,
} from "#/operation-node/with-data-category-node";
import { freeze } from "#/util/object-utils";

export interface SelectQueryNode {
  readonly kind: "SelectQueryNode";
  readonly from: SObjectNode;
  readonly selections?: ReadonlyArray<SelectionNode>;
  readonly usingScope?: UsingScopeNode;
  readonly where?: WhereNode;
  readonly withDataCategory?: WithDataCategoryNode;
  readonly groupBy?: GroupByNode;
  readonly having?: HavingNode;
  readonly orderBy?: OrderByNode;
  readonly limit?: LimitNode;
  readonly offset?: OffsetNode;
  readonly forViewReference?: ForViewReferenceNode;
  readonly knowledgeUpdate?: KnowledgeUpdateNode;
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

  cloneWithUsingScope(
    select: SelectQueryNode,
    usingScope: UsingScopeNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      usingScope,
    });
  },

  cloneWithDataCategorySelection(
    select: SelectQueryNode,
    selection: DataCategorySelectionNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      withDataCategory: select.withDataCategory
        ? WithDataCategoryNode.cloneWithSelection(
            select.withDataCategory,
            selection,
          )
        : WithDataCategoryNode.create(selection),
    });
  },

  cloneWithGroupByItems(
    select: SelectQueryNode,
    items: ReadonlyArray<DateFunctionNode | ReferenceNode>,
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

  cloneWithOffset(
    select: SelectQueryNode,
    offset: OffsetNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      offset,
    });
  },

  cloneWithForViewReference(
    select: SelectQueryNode,
    forViewReference: ForViewReferenceNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      forViewReference,
    });
  },

  cloneWithKnowledgeUpdateMode(
    select: SelectQueryNode,
    mode: KnowledgeUpdateMode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      knowledgeUpdate: select.knowledgeUpdate
        ? KnowledgeUpdateNode.cloneWithMode(select.knowledgeUpdate, mode)
        : KnowledgeUpdateNode.create(mode),
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
