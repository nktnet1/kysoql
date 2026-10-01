import type { AllRowsNode } from "#src/operation-node/all-rows-node";
import type { ApexAccessModeNode } from "#src/operation-node/apex-access-mode-node";
import type { ApexBindExpressionNode } from "#src/operation-node/apex-expression-node";
import type { DateFunctionNode } from "#src/operation-node/date-function-node";
import type { ForUpdateNode } from "#src/operation-node/for-update-node";
import type { ForViewReferenceNode } from "#src/operation-node/for-view-reference-node";
import {
  type AdvancedGroupByMode,
  GroupByNode,
} from "#src/operation-node/group-by-node";
import { HavingNode } from "#src/operation-node/having-node";
import {
  type KnowledgeUpdateMode,
  KnowledgeUpdateNode,
} from "#src/operation-node/knowledge-update-node";
import type { LimitNode } from "#src/operation-node/limit-node";
import type { OffsetNode } from "#src/operation-node/offset-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import type { OrderByItemNode } from "#src/operation-node/order-by-item-node";
import { OrderByNode } from "#src/operation-node/order-by-node";
import type { RecordVisibilityContextNode } from "#src/operation-node/record-visibility-context-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import type { SelectionNode } from "#src/operation-node/selection-node";
import type { SetOptionsNode } from "#src/operation-node/set-options-node";
import type { SObjectNode } from "#src/operation-node/sobject-node";
import type { UserProfileFeedWithNode } from "#src/operation-node/user-profile-feed-with-node";
import type { UsingScopeNode } from "#src/operation-node/using-scope-node";
import type { WhereNode } from "#src/operation-node/where-node";
import {
  type DataCategorySelectionNode,
  WithDataCategoryNode,
} from "#src/operation-node/with-data-category-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a complete SELECT query. */
export interface SelectQueryNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "SelectQueryNode";
  /** Salesforce object queried by this SELECT node. */
  readonly from: SObjectNode;
  /** Selections emitted by this query or subquery. */
  readonly selections?: ReadonlyArray<SelectionNode>;
  /** Optional `USING SCOPE` clause. */
  readonly usingScope?: UsingScopeNode;
  /** Optional `WHERE` expression tree. */
  readonly where?: WhereNode;
  /** Optional UserProfileFeed `WITH USER_ID` clause. */
  readonly userProfileFeedWith?: UserProfileFeedWithNode;
  /** Optional `WITH RECORD_VISIBILITY_CONTEXT` clause. */
  readonly recordVisibilityContext?: RecordVisibilityContextNode;
  /** Optional `WITH DATA CATEGORY` clause. */
  readonly withDataCategory?: WithDataCategoryNode;
  /** Optional Apex user/system access-mode clause. */
  readonly apexAccessMode?: ApexAccessModeNode;
  /** Optional `GROUP BY` clause. */
  readonly groupBy?: GroupByNode;
  /** Optional `HAVING` clause. */
  readonly having?: HavingNode;
  /** Optional `ORDER BY` clause. */
  readonly orderBy?: OrderByNode;
  /** Optional `LIMIT` clause. */
  readonly limit?: LimitNode<number | ApexBindExpressionNode>;
  /** Optional `OFFSET` clause. */
  readonly offset?: OffsetNode<number | ApexBindExpressionNode>;
  /** Optional `FOR VIEW` or `FOR REFERENCE` clause. */
  readonly forViewReference?: ForViewReferenceNode;
  /** Optional KnowledgeArticle update clause. */
  readonly knowledgeUpdate?: KnowledgeUpdateNode;
  /** Optional Apex `ALL ROWS` marker. */
  readonly allRows?: AllRowsNode;
  /** Optional Apex `FOR UPDATE` marker. */
  readonly forUpdate?: ForUpdateNode;
  /** Optional Salesforce `SET OPTIONS` clause. */
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
