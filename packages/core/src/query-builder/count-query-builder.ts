import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { UsingScopeNode } from "#/operation-node/using-scope-node";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
  OperandValueExpression,
} from "#/parser/binary-operation-parser";
import {
  type DataCategoryInput,
  type DataCategorySelector,
  parseDataCategorySelection,
} from "#/parser/data-category-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import type { KnowledgeArticleUpdateCheck } from "#/parser/knowledge-update-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
  parseUserProfileFeedWithUserId,
  type UserProfileFeedWithUserIdCheck,
} from "#/parser/user-profile-feed-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import type {
  SalesforceObjectDataCategory,
  SalesforceObjectDataCategoryGroup,
  SalesforceObjectMruEnabled,
  SalesforceObjectSupportedScope,
} from "#/schema";
import { freeze } from "#/util/object-utils";

export interface CountQueryBuilder<DB, TB extends keyof DB> {
  compile(): CompiledQuery<number>;

  execute(): Promise<number>;

  limit(limit: number): CountQueryBuilder<DB, TB>;

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB>;

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB>;

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): CountQueryBuilder<DB, TB>;

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): CountQueryBuilder<DB, TB>;

  where(expression: WhereExpressionFactory<DB, TB>): CountQueryBuilder<DB, TB>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): CountQueryBuilder<DB, TB>;

  toOperationNode(): SelectQueryNode;
}

class CountQueryBuilderImpl<DB, TB extends keyof DB>
  implements CountQueryBuilder<DB, TB>
{
  readonly #props: CountQueryBuilderProps;

  constructor(props: CountQueryBuilderProps) {
    this.#props = freeze(props);
  }

  compile(): CompiledQuery<number> {
    return this.#props.queryCompiler.compileQuery<number>(
      this.#props.queryNode,
    );
  }

  async execute(): Promise<number> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    if (!this.#props.queryExecutor.executeCountQuery) {
      throw new Error(
        "The configured query executor does not support SOQL COUNT() queries.",
      );
    }

    return this.#props.queryExecutor.executeCountQuery(this.compile());
  }

  limit(limit: number): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("view"),
      ),
    });
  }

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("reference"),
      ),
    });
  }

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "tracking",
      ),
    });
  }

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "viewstat",
      ),
    });
  }

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUsingScope(
        this.#props.queryNode,
        UsingScopeNode.create(scope),
      ),
    });
  }

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUserProfileFeedWith(
        this.#props.queryNode,
        parseUserProfileFeedWithUserId(userId),
      ),
    });
  }

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithDataCategorySelection(
        this.#props.queryNode,
        parseDataCategorySelection(group, selector, categories),
      ),
    });
  }

  where(expression: WhereExpressionFactory<DB, TB>): CountQueryBuilder<DB, TB>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): CountQueryBuilder<DB, TB>;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): CountQueryBuilder<DB, TB> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createExpressionBuilder<DB, TB>({
              outerObject: this.#props.queryNode.from.name,
            }),
          ).toOperationNode()
        : parseFilterBinaryOperation(
            lhsOrExpression,
            op as ComparisonOperator,
            rhs,
            { outerObject: this.#props.queryNode.from.name },
          );
    const queryNode = QueryNode.cloneWithWhere(
      this.#props.queryNode,
      operation,
    );

    validateSemiJoinWhere(queryNode.where?.where ?? operation);

    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode,
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export interface CountQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
}

export function createCountQueryBuilder<DB, TB extends keyof DB>(
  props: CountQueryBuilderProps,
): CountQueryBuilder<DB, TB> {
  return new CountQueryBuilderImpl(props);
}
