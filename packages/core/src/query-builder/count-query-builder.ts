import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#src/expression/expression-builder";
import { ForViewReferenceNode } from "#src/operation-node/for-view-reference-node";
import type { ComparisonOperator } from "#src/operation-node/operator-node";
import { QueryNode } from "#src/operation-node/query-node";
import { SelectQueryNode } from "#src/operation-node/select-query-node";
import { UsingScopeNode } from "#src/operation-node/using-scope-node";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
  OperandValueExpression,
} from "#src/parser/binary-operation-parser";
import {
  type DataCategoryInput,
  type DataCategorySelector,
  parseDataCategorySelection,
} from "#src/parser/data-category-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#src/parser/filter-parser";
import type { KnowledgeArticleUpdateCheck } from "#src/parser/knowledge-update-parser";
import { parseLimit } from "#src/parser/limit-parser";
import {
  parseRecordVisibilityContext,
  type RecordVisibilityContextOptions,
} from "#src/parser/record-visibility-context-parser";
import {
  type Data360AggregateSetOptionsFor,
  parseSetOptions,
} from "#src/parser/set-options-parser";
import {
  parseUserProfileFeedWithUserId,
  type UserProfileFeedWithUserIdCheck,
} from "#src/parser/user-profile-feed-parser";
import {
  type ApexCountQueryBuilder,
  createApexCountQueryBuilder,
  createDynamicApexCountQueryBuilder,
} from "#src/query-builder/apex-count-query-builder";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type { QueryCompiler } from "#src/query-compiler/query-compiler";
import type { AbortableQueryOptions, QueryExecutor } from "#src/query-executor";
import type { QueryId } from "#src/query-id";
import type {
  SalesforceObjectDataCategory,
  SalesforceObjectDataCategoryGroup,
  SalesforceObjectMruEnabled,
  SalesforceObjectSupportedScope,
} from "#src/schema";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#src/soql";
import { freeze } from "#src/util/object-utils";

/** Type-safe builder for Salesforce COUNT() queries. */
export interface CountQueryBuilder<DB, TB extends keyof DB> {
  /** Passes this builder to `func` and returns the callback result. */
  $call<T>(func: (qb: this) => T): T;

  /** Conditionally applies a builder callback; when false, the runtime query is unchanged. */
  $if(condition: boolean, func: (qb: this) => this): this;

  /** Returns a builder with the `LIMIT` clause removed. */
  clearLimit(): CountQueryBuilder<DB, TB>;

  /** Returns a builder with the `WHERE` predicate removed. */
  clearWhere(): CountQueryBuilder<DB, TB>;

  /** Compiles the current operation tree into a `CompiledQuery`. */
  compile(): CompiledQuery<number>;

  /** Compiles and executes the query with the configured executor. */
  execute(options?: AbortableQueryOptions): Promise<number>;

  /** Executes with the executor's Salesforce query-all semantics. */
  executeAll(options?: AbortableQueryOptions): Promise<number>;

  /** Switches to the static Apex builder for the current query. */
  apex(): ApexCountQueryBuilder<DB, TB, "static">;

  /** Switches to the dynamic Apex builder for the current query. */
  dynamicApex(): ApexCountQueryBuilder<DB, TB, "dynamic">;

  /** Adds or replaces the SOQL `LIMIT` clause. */
  limit(limit: number): CountQueryBuilder<DB, TB>;

  /** Adds `FOR VIEW`; available only for MRU-enabled objects. */
  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB>;

  /** Adds `FOR REFERENCE`; available only for MRU-enabled objects. */
  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): CountQueryBuilder<DB, TB>;

  /** Adds the KnowledgeArticle `UPDATE TRACKING` clause. */
  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  /** Adds the KnowledgeArticle `UPDATE VIEWSTAT` clause. */
  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  /** Adds a Salesforce `USING SCOPE` clause validated against schema metadata. */
  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): CountQueryBuilder<DB, TB>;

  /** Adds the UserProfileFeed `WITH USER_ID` clause. */
  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): CountQueryBuilder<DB, TB>;

  /** Adds `WITH RECORD_VISIBILITY_CONTEXT` options. */
  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): CountQueryBuilder<DB, TB>;

  /** Adds object-specific Salesforce `SET OPTIONS` values. */
  setOptions(
    options: Data360AggregateSetOptionsFor<DB[TB]>,
  ): CountQueryBuilder<DB, TB>;

  /** Adds a typed `WITH DATA CATEGORY` filter. */
  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): CountQueryBuilder<DB, TB>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(expression: SoqlRawBuilder): CountQueryBuilder<DB, TB>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(expression: WhereExpressionFactory<DB, TB>): CountQueryBuilder<DB, TB>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): CountQueryBuilder<DB, TB>;

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): SelectQueryNode;
}

class CountQueryBuilderImpl<DB, TB extends keyof DB>
  implements CountQueryBuilder<DB, TB>
{
  readonly #props: CountQueryBuilderProps;

  constructor(props: CountQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $if(condition: boolean, func: (qb: this) => this): this {
    return condition ? func(this) : this;
  }

  clearLimit(): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearWhere(): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<number> {
    return this.#props.queryCompiler.compileQuery<number>(
      this.#props.queryNode,
      { queryId: this.#props.queryId },
    );
  }

  async execute(options?: AbortableQueryOptions): Promise<number> {
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

    return this.#props.queryExecutor.executeCountQuery(this.compile(), options);
  }

  async executeAll(options?: AbortableQueryOptions): Promise<number> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    if (!this.#props.queryExecutor.executeAllCountQuery) {
      throw new Error(
        "The configured query executor does not support Salesforce QueryAll COUNT() execution.",
      );
    }

    return this.#props.queryExecutor.executeAllCountQuery(
      this.compile(),
      options,
    );
  }

  apex(): ApexCountQueryBuilder<DB, TB, "static"> {
    return createApexCountQueryBuilder<DB, TB>(this.#props);
  }

  dynamicApex(): ApexCountQueryBuilder<DB, TB, "dynamic"> {
    return createDynamicApexCountQueryBuilder<DB, TB>(this.#props);
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

  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithRecordVisibilityContext(
        this.#props.queryNode,
        parseRecordVisibilityContext(parameters),
      ),
    });
  }

  setOptions(
    options: Data360AggregateSetOptionsFor<DB[TB]>,
  ): CountQueryBuilder<DB, TB> {
    return new CountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSetOptions(
        this.#props.queryNode,
        parseSetOptions(options),
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

  where(expression: SoqlRawBuilder): CountQueryBuilder<DB, TB>;
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
    lhsOrExpression: string | SoqlRawBuilder | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): CountQueryBuilder<DB, TB> {
    const operation = isSoqlRawBuilder(lhsOrExpression)
      ? lhsOrExpression.toOperationNode()
      : typeof lhsOrExpression === "function"
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
    return (
      this.#props.queryNodeTransformer?.(this.#props.queryNode) ??
      this.#props.queryNode
    );
  }
}

export interface CountQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryId: QueryId;
  readonly queryNode: SelectQueryNode;
  readonly queryNodeTransformer?: (query: SelectQueryNode) => SelectQueryNode;
}

export function createCountQueryBuilder<DB, TB extends keyof DB>(
  props: CountQueryBuilderProps,
): CountQueryBuilder<DB, TB> {
  return new CountQueryBuilderImpl(props);
}
