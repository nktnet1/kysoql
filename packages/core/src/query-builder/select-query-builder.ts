import {
  type CountAllFunctionBuilder,
  createSelectExpressionBuilder,
  type DateFunctionExpression,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import {
  createGeolocationExpressionBuilder,
  type DistanceFunctionExpression,
  type GeolocationExpressionBuilder,
} from "#/expression/geolocation-function-builder";
import type { FieldsSelector } from "#/operation-node/fields-function-node";
import { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import {
  type OrderByDirection,
  OrderByItemNode,
  type OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import { UsingScopeNode } from "#/operation-node/using-scope-node";
import {
  type AggregateSelection,
  type AggregateSelectionArg,
  parseAggregateSelectArg,
  parseCountSelectArg,
} from "#/parser/aggregate-selection-parser";
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
  parseDateGroupByExpression,
  validateDateFunctionSelections,
} from "#/parser/date-function-parser";
import {
  type AvailableSelectExpression,
  type CheckedSelectExpressionList,
  type FieldsSelection,
  type FieldsSelectionCheck,
  parseFieldsSelection,
} from "#/parser/fields-selection-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import {
  type GroupableFieldName,
  parseGroupBy,
} from "#/parser/group-by-parser";
import { validateGroupingSelections } from "#/parser/grouping-expression-parser";
import type { KnowledgeArticleUpdateCheck } from "#/parser/knowledge-update-parser";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import {
  type OrderByNullsForReference,
  parseDistanceOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import {
  parseRecordVisibilityContext,
  type RecordVisibilityContextOptions,
} from "#/parser/record-visibility-context-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import {
  isSelectFunctionSelectionArg,
  parseSelectFunctionSelectArg,
  type SelectFunctionSelection,
  type SelectFunctionSelectionArg,
  validateUniqueSelectionAliases,
} from "#/parser/select-function-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  type Data360SetOptionsFor,
  parseSetOptions,
} from "#/parser/set-options-parser";
import {
  type AvailableTypeOfReference,
  type PolymorphicRelationshipReference,
  type PolymorphicRelationshipTargets,
  type TypeOfSelection,
  validateTypeOfSelections,
} from "#/parser/type-of-parser";
import {
  parseUserProfileFeedWithUserId,
  type UserProfileFeedWithUserIdCheck,
} from "#/parser/user-profile-feed-parser";
import {
  type AggregateSelectQueryBuilder,
  createAggregateSelectQueryBuilder,
  createGroupedSelectQueryBuilder,
} from "#/query-builder/aggregate-select-query-builder";
import {
  type ApexSelectQueryBuilder,
  createApexSelectQueryBuilder,
  createDynamicApexSelectQueryBuilder,
} from "#/query-builder/apex-select-query-builder";
import {
  type CountQueryBuilder,
  createCountQueryBuilder,
} from "#/query-builder/count-query-builder";
import {
  type ExecuteTakeFirstOrThrowOptions,
  isNoResultErrorConstructor,
  NoResultError,
  type NoResultErrorConstructor,
} from "#/query-builder/no-result-error";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#/query-builder/relationship-subquery-builder";
import {
  createTypeOfBuilder,
  type TypeOfBuilder,
  type TypeOfBuilderHandled,
  type TypeOfBuilderHasElse,
  type TypeOfBuilderOutput,
} from "#/query-builder/type-of-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";
import { applyQueryResultAliases } from "#/query-result-mapper";
import type {
  SalesforceObjectDataCategory,
  SalesforceObjectDataCategoryGroup,
  SalesforceObjectMruEnabled,
  SalesforceObjectSupportedScope,
  SalesforceQueryResult,
} from "#/schema";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#/soql";
import { freeze } from "#/util/object-utils";
import type { KysoqlTypeError } from "#/util/type-error";
import type {
  ConditionalOutput,
  NarrowPartial,
  Simplify,
} from "#/util/type-utils";

type ChildObjectForRelationship<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> = ChildObjectName<
  DB,
  TB,
  Extract<Relationship, ChildRelationshipName<DB, TB>>
>;

type UnselectedOnly<O, Value> = [keyof O] extends [never] ? Value : never;

type CountSelectionFactory<DB, TB extends keyof DB> = (
  eb: SelectExpressionBuilder<DB, TB>,
) => CountAllFunctionBuilder;

type AggregateSelectionFactory<
  DB,
  TB extends keyof DB,
  Aggregate extends AggregateSelectionArg,
> = (eb: SelectExpressionBuilder<DB, TB>) => Aggregate;

type SelectFunctionSelectionFactory<
  DB,
  TB extends keyof DB,
  FunctionSelection extends SelectFunctionSelectionArg,
> = (eb: SelectExpressionBuilder<DB, TB>) => FunctionSelection;

type DistanceOrderByFactory<DB, TB extends keyof DB> = (
  eb: GeolocationExpressionBuilder<DB, TB>,
) => DistanceFunctionExpression<unknown, boolean, true>;

type DateFunctionIdentityOf<Expression> =
  Expression extends DateFunctionExpression<
    unknown,
    unknown,
    ComparisonOperator,
    infer Identity
  >
    ? Identity
    : never;

export type SelectQueryMode = "plain" | "function" | "typeof";

type AfterSelectFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "plain" ? "function" : Mode;

type AfterTypeOfMode<Mode extends SelectQueryMode> = Mode extends "plain"
  ? "typeof"
  : Mode;

type AfterSubqueryMode<
  Mode extends SelectQueryMode,
  SubqueryFunctionMode extends "none" | "present" | "forbidden",
> = SubqueryFunctionMode extends "present"
  ? AfterSelectFunctionMode<Mode>
  : Mode;

type InitialSubqueryFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "typeof" ? "forbidden" : "none";

type SelectFunctionFactoryForMode<
  Mode extends SelectQueryMode,
  Factory,
> = Mode extends "typeof" ? never : Factory;

type TypeOfModeCheck<Mode extends SelectQueryMode> = Mode extends "function"
  ? readonly [incompatibleQueryMode: never]
  : readonly [];

type CompletedTypeOfBuilder = {
  toOperationNode(): TypeOfNode;
};

type TypeOfValue<Targets extends string, Builder> =
  | TypeOfBuilderOutput<Builder>
  | (TypeOfBuilderHasElse<Builder> extends true
      ? never
      : Exclude<Targets, TypeOfBuilderHandled<Builder>> extends never
        ? never
        : null);

export interface SelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = SelectQueryMode,
> {
  $call<T>(func: (qb: this) => T): T;

  $assertType<T extends O>(): O extends T
    ? SelectQueryBuilder<DB, TB, T, Mode>
    : KysoqlTypeError<"$assertType() call failed: The type passed in is not equal to the output type of the query.">;

  $castTo<C>(): SelectQueryBuilder<DB, TB, C, Mode>;

  $narrowType<T>(): SelectQueryBuilder<DB, TB, NarrowPartial<O, T>, Mode>;

  $if<O2>(
    condition: boolean,
    func: (qb: this) => SelectQueryBuilder<DB, TB, O & O2, Mode>,
  ): SelectQueryBuilder<DB, TB, ConditionalOutput<O, O2>, Mode>;

  clearLimit(): SelectQueryBuilder<DB, TB, O, Mode>;

  clearOffset(): SelectQueryBuilder<DB, TB, O, Mode>;

  clearOrderBy(): SelectQueryBuilder<DB, TB, O, Mode>;

  clearSelect(): SelectQueryBuilder<DB, TB, unknown, "plain">;

  clearWhere(): SelectQueryBuilder<DB, TB, O, Mode>;

  compile(): CompiledQuery<O>;

  execute(options?: AbortableQueryOptions): Promise<readonly O[]>;

  executeTakeFirst(options?: AbortableQueryOptions): Promise<O | undefined>;

  executeTakeFirstOrThrow(
    options?:
      | ExecuteTakeFirstOrThrowOptions
      | NoResultErrorConstructor
      | ((node: SelectQueryNode) => Error),
  ): Promise<O>;

  executeAll(options?: AbortableQueryOptions): Promise<readonly O[]>;

  apex(): ApexSelectQueryBuilder<DB, TB, O, Mode, "static">;

  dynamicApex(): ApexSelectQueryBuilder<DB, TB, O, Mode, "dynamic">;

  limit(limit: number): SelectQueryBuilder<DB, TB, O, Mode>;

  offset(offset: number): SelectQueryBuilder<DB, TB, O, Mode>;

  groupBy<GE extends string>(
    field: UnselectedOnly<O, GE & GroupableFieldName<DB, TB, GE>>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GE, "ordinary", 0>;

  groupBy<GE extends string>(
    fields: UnselectedOnly<
      O,
      ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>
    >,
  ): AggregateSelectQueryBuilder<DB, TB, O, GE, "ordinary", 0>;

  groupBy<
    Expression extends DateFunctionExpression<
      unknown,
      unknown,
      ComparisonOperator,
      string
    >,
  >(
    expression: UnselectedOnly<
      O,
      (eb: SelectExpressionBuilder<DB, TB>) => Expression
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    DateFunctionIdentityOf<Expression>,
    "ordinary",
    0
  >;

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  setOptions(
    options: Data360SetOptionsFor<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  orderBy(
    expression: SoqlRawBuilder,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  where(expression: SoqlRawBuilder): SelectQueryBuilder<DB, TB, O, Mode>;
  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O, Mode>;

  select<RawOutput>(
    selection: SoqlRawBuilder<RawOutput>,
  ): SelectQueryBuilder<DB, TB, O & RawOutput, Mode>;
  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;

  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionFactoryForMode<
      Mode,
      SelectFunctionSelectionFactory<DB, TB, FunctionSelection>
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    AfterSelectFunctionMode<Mode>
  >;

  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;

  select<const Selections extends readonly string[]>(
    selections: Selections & CheckedSelectExpressionList<DB, TB, O, Selections>,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, Selections[number]>,
    Mode
  >;

  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;

  /** Select a server-expanded group; unavailable on field-filtered schemas. */
  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ...check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): SelectQueryBuilder<DB, TB, O & FieldsSelection<DB, TB, Selector>, Mode>;

  selectTypeOf<
    Reference extends string,
    Builder extends CompletedTypeOfBuilder,
  >(
    reference: Reference &
      PolymorphicRelationshipReference<DB, TB, Reference> &
      AvailableTypeOfReference<O, Reference>,
    callback: (
      typeOf: TypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >,
    ) => Builder,
    ..._modeCheck: TypeOfModeCheck<Mode>
  ): SelectQueryBuilder<
    DB,
    TB,
    O &
      TypeOfSelection<
        DB,
        TB,
        Reference,
        TypeOfValue<PolymorphicRelationshipTargets<DB, TB, Reference>, Builder>
      >,
    AfterTypeOfMode<Mode>
  >;

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends "none" | "present" | "forbidden",
  >(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        unknown,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
  >;

  toOperationNode(): SelectQueryNode;
}

class SelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
> implements SelectQueryBuilder<DB, TB, O, Mode>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $assertType<T extends O>(): O extends T
    ? SelectQueryBuilder<DB, TB, T, Mode>
    : KysoqlTypeError<"$assertType() call failed: The type passed in is not equal to the output type of the query."> {
    return new SelectQueryBuilderImpl({ ...this.#props }) as never;
  }

  $castTo<C>(): SelectQueryBuilder<DB, TB, C, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, C, Mode>({ ...this.#props });
  }

  $narrowType<T>(): SelectQueryBuilder<DB, TB, NarrowPartial<O, T>, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, NarrowPartial<O, T>, Mode>({
      ...this.#props,
    });
  }

  $if<O2>(
    condition: boolean,
    func: (qb: this) => SelectQueryBuilder<DB, TB, O & O2, Mode>,
  ): SelectQueryBuilder<DB, TB, ConditionalOutput<O, O2>, Mode> {
    return (condition ? func(this) : this) as SelectQueryBuilder<
      DB,
      TB,
      ConditionalOutput<O, O2>,
      Mode
    >;
  }

  clearLimit(): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearOffset(): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOffset(this.#props.queryNode),
    });
  }

  clearOrderBy(): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOrderBy(this.#props.queryNode),
    });
  }

  clearSelect(): SelectQueryBuilder<DB, TB, unknown, "plain"> {
    return new SelectQueryBuilderImpl<DB, TB, unknown, "plain">({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutSelections(this.#props.queryNode),
    });
  }

  clearWhere(): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  async execute(options?: AbortableQueryOptions): Promise<readonly O[]> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    const compiled = this.compile();
    const records = await this.#props.queryExecutor.executeQuery(
      compiled,
      options,
    );
    return applyQueryResultAliases<O>(
      compiled.query,
      records as unknown as readonly Record<string, unknown>[],
    );
  }

  async executeTakeFirst(
    options?: AbortableQueryOptions,
  ): Promise<O | undefined> {
    const [result] = await this.execute(options);
    return result;
  }

  async executeTakeFirstOrThrow(
    errorConstructorOrOptions:
      | ExecuteTakeFirstOrThrowOptions
      | NoResultErrorConstructor
      | ((node: SelectQueryNode) => Error) = {},
  ): Promise<O> {
    const isFactory = typeof errorConstructorOrOptions === "function";
    const errorConstructor = isFactory
      ? errorConstructorOrOptions
      : (errorConstructorOrOptions.errorConstructor ?? NoResultError);
    const executeOptions =
      isFactory || errorConstructorOrOptions.signal === undefined
        ? undefined
        : { signal: errorConstructorOrOptions.signal };
    const result = await this.executeTakeFirst(executeOptions);

    if (result !== undefined) {
      return result;
    }

    throw isNoResultErrorConstructor(errorConstructor)
      ? new errorConstructor(this.#props.queryNode)
      : errorConstructor(this.#props.queryNode);
  }

  async executeAll(options?: AbortableQueryOptions): Promise<readonly O[]> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    if (!this.#props.queryExecutor.executeAllQuery) {
      throw new Error(
        "The configured query executor does not support Salesforce QueryAll execution.",
      );
    }

    const compiled = this.compile();
    const records = await this.#props.queryExecutor.executeAllQuery(
      compiled,
      options,
    );
    return applyQueryResultAliases<O>(
      compiled.query,
      records as unknown as readonly Record<string, unknown>[],
    );
  }

  apex(): ApexSelectQueryBuilder<DB, TB, O, Mode, "static"> {
    return createApexSelectQueryBuilder<DB, TB, O, Mode>(this.#props);
  }

  dynamicApex(): ApexSelectQueryBuilder<DB, TB, O, Mode, "dynamic"> {
    return createDynamicApexSelectQueryBuilder<DB, TB, O, Mode>(this.#props);
  }

  limit(limit: number): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  offset(offset: number): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseOffset(offset),
      ),
    });
  }

  groupBy<GE extends string>(
    field: UnselectedOnly<O, GE & GroupableFieldName<DB, TB, GE>>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GE, "ordinary", 0>;
  groupBy<GE extends string>(
    fields: UnselectedOnly<
      O,
      ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>
    >,
  ): AggregateSelectQueryBuilder<DB, TB, O, GE, "ordinary", 0>;
  groupBy<
    Expression extends DateFunctionExpression<
      unknown,
      unknown,
      ComparisonOperator,
      string
    >,
  >(
    expression: UnselectedOnly<
      O,
      (eb: SelectExpressionBuilder<DB, TB>) => Expression
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    DateFunctionIdentityOf<Expression>,
    "ordinary",
    0
  >;
  groupBy<GE extends string>(
    groupBy:
      | (GE & GroupableFieldName<DB, TB, GE>)
      | ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>
      | ((
          eb: SelectExpressionBuilder<DB, TB>,
        ) => DateFunctionExpression<
          unknown,
          unknown,
          ComparisonOperator,
          string
        >),
  ): AggregateSelectQueryBuilder<DB, TB, O, GE, "ordinary", 0> {
    assertDirectGroupByState(this.#props.queryNode);

    const parsed =
      typeof groupBy === "function"
        ? [
            parseDateGroupByExpression(
              groupBy(createSelectExpressionBuilder<DB, TB>()) as never,
            ),
          ]
        : parseGroupBy(groupBy);

    return createGroupedSelectQueryBuilder<DB, TB, O, GE>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithGroupByItems(
        this.#props.queryNode,
        parsed,
      ),
    });
  }

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
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
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("reference"),
      ),
    });
  }

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "tracking",
      ),
    });
  }

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "viewstat",
      ),
    });
  }

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
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
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUserProfileFeedWith(
        this.#props.queryNode,
        parseUserProfileFeedWithUserId(userId),
      ),
    });
  }

  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithRecordVisibilityContext(
        this.#props.queryNode,
        parseRecordVisibilityContext(parameters),
      ),
    });
  }

  setOptions(
    options: Data360SetOptionsFor<DB[TB]>,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
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
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithDataCategorySelection(
        this.#props.queryNode,
        parseDataCategorySelection(group, selector, categories),
      ),
    });
  }

  orderBy(
    expression: SoqlRawBuilder,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  orderBy(
    fieldOrExpression: string | SoqlRawBuilder | DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
    const item = isSoqlRawBuilder(fieldOrExpression)
      ? OrderByItemNode.create(
          fieldOrExpression.toOperationNode(),
          direction,
          nulls,
        )
      : typeof fieldOrExpression === "function"
        ? parseDistanceOrderBy(
            fieldOrExpression(createGeolocationExpressionBuilder<DB, TB>()),
            direction,
            nulls,
          )
        : parseOrderBy(fieldOrExpression, direction, nulls);

    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        item,
      ]),
    });
  }

  where(expression: SoqlRawBuilder): SelectQueryBuilder<DB, TB, O, Mode>;
  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O, Mode>;
  where(
    lhsOrExpression: string | SoqlRawBuilder | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): SelectQueryBuilder<DB, TB, O, Mode> {
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

    return new SelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode,
    });
  }

  select<RawOutput>(
    selection: SoqlRawBuilder<RawOutput>,
  ): SelectQueryBuilder<DB, TB, O & RawOutput, Mode>;
  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;
  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionFactoryForMode<
      Mode,
      SelectFunctionSelectionFactory<DB, TB, FunctionSelection>
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    AfterSelectFunctionMode<Mode>
  >;
  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;
  select<const Selections extends readonly string[]>(
    selections: Selections & CheckedSelectExpressionList<DB, TB, O, Selections>,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, Selections[number]>,
    Mode
  >;
  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Mode>;
  select(
    selection:
      | string
      | readonly string[]
      | SoqlRawBuilder<unknown>
      | ((eb: SelectExpressionBuilder<DB, TB>) => unknown),
  ):
    | AggregateSelectQueryBuilder<DB, TB, unknown>
    | CountQueryBuilder<DB, TB>
    | SelectQueryBuilder<DB, TB, unknown> {
    if (isSoqlRawBuilder(selection)) {
      const selections = [SelectionNode.create(selection.toOperationNode())];
      const queryNode = SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        selections,
      );
      validateTypeOfSelections(queryNode);

      return new SelectQueryBuilderImpl<DB, TB, unknown, Mode>({
        ...this.#props,
        queryNode,
      });
    }

    if (typeof selection !== "function") {
      const selections = parseSelectArg(selection);
      validateUniqueSelectionAliases(
        this.#props.queryNode.selections ?? [],
        selections,
      );
      const queryNode = SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        selections,
      );
      validateTypeOfSelections(queryNode);

      return new SelectQueryBuilderImpl<DB, TB, unknown, Mode>({
        ...this.#props,
        queryNode,
      });
    }

    const expression = selection(createSelectExpressionBuilder<DB, TB>());

    if (isSelectFunctionSelectionArg(expression)) {
      assertNoTypeOfSelections(this.#props.queryNode);

      const selections = parseSelectFunctionSelectArg(
        expression as SelectFunctionSelectionArg,
      );

      validateUniqueSelectionAliases(
        this.#props.queryNode.selections ?? [],
        selections,
      );

      return new SelectQueryBuilderImpl<
        DB,
        TB,
        unknown,
        AfterSelectFunctionMode<Mode>
      >({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(
          this.#props.queryNode,
          selections,
        ),
      });
    }

    assertNoExistingSelections(this.#props.queryNode);

    if (isCountAllFunctionBuilder(expression)) {
      assertCountClauses(this.#props.queryNode);

      return createCountQueryBuilder<DB, TB>({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
          parseCountSelectArg(expression),
        ]),
      });
    }

    assertAggregateClauses(this.#props.queryNode);

    const selections = parseAggregateSelectArg(
      expression as AggregateSelectionArg,
    );

    validateGroupingSelections(selections, []);
    validateDateFunctionSelections(selections, []);

    return createAggregateSelectQueryBuilder<DB, TB, unknown>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        selections,
      ),
    });
  }

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ..._check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): SelectQueryBuilder<DB, TB, O & FieldsSelection<DB, TB, Selector>, Mode> {
    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O & FieldsSelection<DB, TB, Selector>,
      Mode
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
        parseFieldsSelection(selector),
      ]),
    });
  }

  selectTypeOf<
    Reference extends string,
    Builder extends CompletedTypeOfBuilder,
  >(
    reference: Reference &
      PolymorphicRelationshipReference<DB, TB, Reference> &
      AvailableTypeOfReference<O, Reference>,
    callback: (
      typeOf: TypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >,
    ) => Builder,
    ..._modeCheck: TypeOfModeCheck<Mode>
  ): SelectQueryBuilder<
    DB,
    TB,
    O &
      TypeOfSelection<
        DB,
        TB,
        Reference,
        TypeOfValue<PolymorphicRelationshipTargets<DB, TB, Reference>, Builder>
      >,
    AfterTypeOfMode<Mode>
  > {
    assertNoSelectFunctionSelections(this.#props.queryNode);

    const typeOf = callback(
      createTypeOfBuilder<
        DB,
        PolymorphicRelationshipTargets<DB, TB, Reference>
      >(ReferenceNode.create(reference as string)),
    );

    if (
      typeof typeOf !== "object" ||
      typeOf === null ||
      !("toOperationNode" in typeOf) ||
      typeof typeOf.toOperationNode !== "function"
    ) {
      throw new TypeError("SOQL TYPEOF requires at least one WHEN branch.");
    }

    const node = typeOf.toOperationNode() as TypeOfNode;
    if (node.whens.length === 0) {
      throw new TypeError("SOQL TYPEOF requires at least one WHEN branch.");
    }

    const queryNode = SelectQueryNode.cloneWithSelections(
      this.#props.queryNode,
      [SelectionNode.create(node)],
    );
    validateTypeOfSelections(queryNode);

    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O &
        TypeOfSelection<
          DB,
          TB,
          Reference,
          TypeOfValue<
            PolymorphicRelationshipTargets<DB, TB, Reference>,
            Builder
          >
        >,
      AfterTypeOfMode<Mode>
    >({
      ...this.#props,
      queryNode,
    });
  }

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends "none" | "present" | "forbidden",
  >(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        unknown,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        unknown,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
        apex: false,
      }),
    );

    const queryNode = SelectQueryNode.cloneWithSelections(
      this.#props.queryNode,
      [SelectionNode.create(subquery.toOperationNode())],
    );
    validateTypeOfSelections(queryNode);

    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O & {
        readonly [Key in Relationship]: SalesforceQueryResult<
          Simplify<SubqueryOutput>
        >;
      },
      AfterSubqueryMode<Mode, SubqueryFunctionMode>
    >({
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

export interface SelectQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
  readonly queryNodeTransformer?: (query: SelectQueryNode) => SelectQueryNode;
}

export function createSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = "plain",
>(props: SelectQueryBuilderProps): SelectQueryBuilder<DB, TB, O, Mode> {
  return new SelectQueryBuilderImpl<DB, TB, O, Mode>(props);
}

function assertDirectGroupByState(queryNode: SelectQueryNode): void {
  assertNoExistingSelections(queryNode);

  if (queryNode.orderBy || queryNode.offset) {
    throw new TypeError(
      "SOQL direct GROUP BY must be added before ORDER BY or OFFSET.",
    );
  }
}

function assertNoTypeOfSelections(queryNode: SelectQueryNode): void {
  if (
    queryNode.selections?.some(
      (selection) => selection.selection.kind === "TypeOfNode",
    )
  ) {
    throw new TypeError(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );
  }
}

function assertNoSelectFunctionSelections(queryNode: SelectQueryNode): void {
  if (
    queryNode.selections?.some(
      (selection) =>
        selection.selection.kind === "AliasNode" &&
        selection.selection.node.kind !== "ReferenceNode",
    )
  ) {
    throw new TypeError(
      "SOQL TYPEOF cannot be combined with SELECT function expressions.",
    );
  }
}

function isCountAllFunctionBuilder(
  value: unknown,
): value is CountAllFunctionBuilder {
  if (
    typeof value !== "object" ||
    value === null ||
    !("toOperationNode" in value) ||
    typeof value.toOperationNode !== "function"
  ) {
    return false;
  }

  const node = value.toOperationNode();

  return (
    node.kind === "AggregateFunctionNode" &&
    node.function === "count" &&
    node.reference === undefined
  );
}

function assertNoExistingSelections(queryNode: SelectQueryNode): void {
  if (queryNode.selections?.length) {
    throw new TypeError(
      "Start SOQL grouping or aggregate mode before selecting grouped record fields.",
    );
  }
}

function assertAggregateClauses(queryNode: SelectQueryNode): void {
  if (queryNode.orderBy || queryNode.limit || queryNode.offset) {
    throw new TypeError(
      "SOQL aggregate queries without GROUP BY cannot use ORDER BY, LIMIT, or OFFSET.",
    );
  }
}

function assertCountClauses(queryNode: SelectQueryNode): void {
  if (queryNode.orderBy || queryNode.offset) {
    throw new TypeError("SOQL COUNT() queries cannot use ORDER BY or OFFSET.");
  }
}
