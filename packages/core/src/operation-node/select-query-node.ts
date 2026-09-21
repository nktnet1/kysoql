import type { AllRowsNode } from "#/operation-node/all-rows-node";
import type { ApexAccessModeNode } from "#/operation-node/apex-access-mode-node";
import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { ForUpdateNode } from "#/operation-node/for-update-node";
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
import type { RecordVisibilityContextNode } from "#/operation-node/record-visibility-context-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { SetOptionsNode } from "#/operation-node/set-options-node";
import type { SObjectNode } from "#/operation-node/sobject-node";
import type { UserProfileFeedWithNode } from "#/operation-node/user-profile-feed-with-node";
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
  readonly userProfileFeedWith?: UserProfileFeedWithNode;
  readonly recordVisibilityContext?: RecordVisibilityContextNode;
  readonly withDataCategory?: WithDataCategoryNode;
  readonly apexAccessMode?: ApexAccessModeNode;
  readonly groupBy?: GroupByNode;
  readonly having?: HavingNode;
  readonly orderBy?: OrderByNode;
  readonly limit?: LimitNode<number | ApexBindExpressionNode>;
  readonly offset?: OffsetNode<number | ApexBindExpressionNode>;
  readonly forViewReference?: ForViewReferenceNode;
  readonly knowledgeUpdate?: KnowledgeUpdateNode;
  readonly allRows?: AllRowsNode;
  readonly forUpdate?: ForUpdateNode;
  readonly setOptions?: SetOptionsNode;
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

  cloneWithoutSelections(select: SelectQueryNode): SelectQueryNode {
    const { selections: _selections, ...withoutSelections } = select;

    return freeze(withoutSelections);
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

  cloneWithUserProfileFeedWith(
    select: SelectQueryNode,
    userProfileFeedWith: UserProfileFeedWithNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      userProfileFeedWith,
    });
  },

  cloneWithRecordVisibilityContext(
    select: SelectQueryNode,
    recordVisibilityContext: RecordVisibilityContextNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      recordVisibilityContext,
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

  cloneWithApexAccessMode(
    select: SelectQueryNode,
    apexAccessMode: ApexAccessModeNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      apexAccessMode,
    });
  },

  cloneWithSetOptions(
    select: SelectQueryNode,
    setOptions: SetOptionsNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      setOptions,
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

  cloneWithoutGroupBy(select: SelectQueryNode): SelectQueryNode {
    const { groupBy: _groupBy, ...withoutGroupBy } = select;

    return freeze(withoutGroupBy);
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

  cloneWithLimit(
    select: SelectQueryNode,
    limit: LimitNode<number | ApexBindExpressionNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      limit,
    });
  },

  cloneWithoutLimit(select: SelectQueryNode): SelectQueryNode {
    const { limit: _limit, ...withoutLimit } = select;

    return freeze(withoutLimit);
  },

  cloneWithOffset(
    select: SelectQueryNode,
    offset: OffsetNode<number | ApexBindExpressionNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      offset,
    });
  },

  cloneWithoutOffset(select: SelectQueryNode): SelectQueryNode {
    const { offset: _offset, ...withoutOffset } = select;

    return freeze(withoutOffset);
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

  cloneWithAllRows(
    select: SelectQueryNode,
    allRows: AllRowsNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      allRows,
    });
  },

  cloneWithForUpdate(
    select: SelectQueryNode,
    forUpdate: ForUpdateNode,
  ): SelectQueryNode {
    return freeze({
      ...select,
      forUpdate,
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

  cloneWithoutOrderBy(select: SelectQueryNode): SelectQueryNode {
    const { orderBy: _orderBy, ...withoutOrderBy } = select;

    return freeze(withoutOrderBy);
  },
};
