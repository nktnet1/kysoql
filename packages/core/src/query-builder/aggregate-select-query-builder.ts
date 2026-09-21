import {
  type AggregateFunctionBuilder,
  type AggregateFunctionExpression,
  type AliasedDateFunctionBuilder,
  createSelectExpressionBuilder,
  type DateFunctionExpression,
  type GroupingFunctionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import {
  createHavingExpressionBuilder,
  type GroupedHavingFieldName,
  type HavingExpressionFactory,
} from "#/expression/having-expression-builder";
import { ForViewReferenceNode } from "#/operation-node/for-view-reference-node";
import type { AdvancedGroupByMode } from "#/operation-node/group-by-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import { UsingScopeNode } from "#/operation-node/using-scope-node";
import {
  type AggregateSelection,
  type AggregateSelectionArg,
  type GroupedSelectionArg,
  parseAggregateSelectArg,
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
  dateFunctionIdentity,
  parseDateGroupByExpression,
  validateDateFunctionSelections,
  validateGroupedDateFunctionNode,
} from "#/parser/date-function-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import {
  assertCanClearGroupBy,
  type GroupableFieldName,
  parseAdvancedGroupBy,
  parseGroupBy,
} from "#/parser/group-by-parser";
import { validateGroupingSelections } from "#/parser/grouping-expression-parser";
import type { KnowledgeArticleUpdateCheck } from "#/parser/knowledge-update-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
  type OrderByNullsForReference,
  parseAggregateOrderBy,
  parseGroupingOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import {
  parseRecordVisibilityContext,
  type RecordVisibilityContextOptions,
} from "#/parser/record-visibility-context-parser";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  parseUserProfileFeedWithUserId,
  type UserProfileFeedWithUserIdCheck,
} from "#/parser/user-profile-feed-parser";
import {
  type ApexAggregateSelectQueryBuilder,
  createApexAggregateSelectQueryBuilder,
} from "#/query-builder/apex-aggregate-select-query-builder";
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
import type { ConditionalOutput } from "#/util/type-utils";

type AggregateGroupMode = "none" | "ordinary" | AdvancedGroupByMode;
type AdvancedGroupFieldCount = 0 | 1 | 2 | 3;
type AdvancedGroupByInput = string | readonly string[];

type GroupedOnly<GroupedBy extends string, Value> = [GroupedBy] extends [never]
  ? never
  : Value;

type AdvancedGroupingFields<
  GroupedBy extends string,
  GroupMode extends AggregateGroupMode,
> = GroupMode extends AdvancedGroupByMode ? GroupedBy : never;

type AdvancedGroupingOnly<
  GroupMode extends AggregateGroupMode,
  Value,
> = GroupMode extends AdvancedGroupByMode ? Value : never;

type GroupingOrderByExpressionFactory<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
> = (eb: SelectExpressionBuilder<DB, TB, GroupedBy>) => GroupingFunctionBuilder;

type AggregateOrderByExpressionFactory<DB, TB extends keyof DB> = (
  eb: SelectExpressionBuilder<DB, TB>,
) => AggregateFunctionExpression<unknown>;

type DateFunctionIdentityOf<Expression> =
  Expression extends DateFunctionExpression<
    unknown,
    unknown,
    ComparisonOperator,
    infer Identity
  >
    ? Identity
    : never;

type DateFunctionArgumentReference<Identity extends string> =
  Identity extends `${string}(${infer Reference})`
    ? Reference extends `${string}(${string})`
      ? never
      : Reference
    : never;

type SelectableGroupedDateFunctionIdentity<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  GroupMode extends AggregateGroupMode,
  Identity extends string,
> = Identity extends GroupedBy
  ? Identity
  : GroupMode extends "ordinary"
    ? DateFunctionArgumentReference<Identity> extends infer Reference extends
        string
      ? Reference extends GroupedBy
        ? FieldReferenceDefinition<DB, TB, Reference> extends {
            readonly salesforceType: "date";
          }
          ? Identity
          : never
        : never
      : never
    : never;

type GroupedFunctionSelection<
  DB,
  TB extends keyof DB,
  Selection,
  GroupedBy extends string,
  GroupMode extends AggregateGroupMode,
> = Selection extends readonly unknown[]
  ? {
      readonly [Index in keyof Selection]: GroupedFunctionSelection<
        DB,
        TB,
        Selection[Index],
        GroupedBy,
        GroupMode
      >;
    }
  : Selection extends AliasedDateFunctionBuilder<
        unknown,
        string,
        infer Identity
      >
    ? Identity extends SelectableGroupedDateFunctionIdentity<
        DB,
        TB,
        GroupedBy,
        GroupMode,
        Identity
      >
      ? Selection
      : never
    : Selection;

type GroupModeOnly<
  Current extends AggregateGroupMode,
  Target extends Exclude<AggregateGroupMode, "none">,
  Value,
> = Current extends "none" | Target ? Value : never;

type NextGroupMode<
  Current extends AggregateGroupMode,
  Target extends Exclude<AggregateGroupMode, "none">,
> = Current extends "none" ? Target : Current;

type GroupedSelectExpression<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  SE extends string,
> = SE extends GroupedBy ? SelectExpression<DB, TB, SE> : never;

type GroupedSortableFieldName<
  DB,
  TB extends keyof DB,
  GroupedBy extends string,
  Reference extends string,
> = Reference extends GroupedBy ? SortableFieldName<DB, TB, Reference> : never;

type GroupedSelection<
  DB,
  TB extends keyof DB,
  SE,
  GroupMode extends AggregateGroupMode,
> = Selection<DB, TB, SE, GroupMode extends AdvancedGroupByMode ? true : false>;

type AdvancedGroupByAllowedLength<Count extends AdvancedGroupFieldCount> =
  Count extends 0
    ? 1 | 2 | 3
    : Count extends 1
      ? 1 | 2
      : Count extends 2
        ? 1
        : never;

type AdvancedGroupByShape<
  Count extends AdvancedGroupFieldCount,
  Input extends AdvancedGroupByInput,
> = Input extends string
  ? Count extends 3
    ? never
    : Input
  : Input extends readonly string[]
    ? Input extends readonly []
      ? never
      : Input["length"] extends AdvancedGroupByAllowedLength<Count>
        ? Input
        : never
    : never;

type GroupableGroupByInput<
  DB,
  TB extends keyof DB,
  Input extends AdvancedGroupByInput,
> = Input extends string
  ? Input & GroupableFieldName<DB, TB, Input>
  : Input extends readonly string[]
    ? {
        readonly [Index in keyof Input]: Input[Index] extends string
          ? Input[Index] & GroupableFieldName<DB, TB, Input[Index]>
          : Input[Index];
      }
    : never;

type AdvancedGroupByArgument<
  DB,
  TB extends keyof DB,
  Count extends AdvancedGroupFieldCount,
  Input extends AdvancedGroupByInput,
> = Input &
  AdvancedGroupByShape<Count, Input> &
  GroupableGroupByInput<DB, TB, Input>;

type AdvancedGroupByField<Input extends AdvancedGroupByInput> =
  Input extends string ? Input : Input[number];

type AdvancedGroupByInputCount<Input extends AdvancedGroupByInput> =
  Input extends string
    ? 1
    : Input extends readonly [string]
      ? 1
      : Input extends readonly [string, string]
        ? 2
        : Input extends readonly [string, string, string]
          ? 3
          : never;

type AddAdvancedGroupFieldCount<
  Count extends AdvancedGroupFieldCount,
  Added extends 1 | 2 | 3,
> = Count extends 0
  ? Added
  : Count extends 1
    ? Added extends 1
      ? 2
      : 3
    : Count extends 2
      ? 3
      : 3;

type NextAdvancedGroupFieldCount<
  Count extends AdvancedGroupFieldCount,
  Input extends AdvancedGroupByInput,
> = AddAdvancedGroupFieldCount<Count, AdvancedGroupByInputCount<Input>>;

export interface AggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  GroupedBy extends string = never,
  GroupMode extends AggregateGroupMode = "none",
  AdvancedFieldCount extends AdvancedGroupFieldCount = 0,
> {
  $call<T>(func: (qb: this) => T): T;

  $if<O2>(
    condition: boolean,
    func: (
      qb: this,
    ) => AggregateSelectQueryBuilder<
      DB,
      TB,
      O & O2,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    ConditionalOutput<O, O2>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  clearGroupBy(): AggregateSelectQueryBuilder<DB, TB, O, never, "none", 0>;

  clearLimit(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  clearOrderBy(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  clearSelect(): AggregateSelectQueryBuilder<
    DB,
    TB,
    unknown,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  clearWhere(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  executeAll(): Promise<readonly O[]>;

  apex(): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  forReference(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  withUserId(
    userId: string,
    ..._userProfileFeedCheck: UserProfileFeedWithUserIdCheck<TB>
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  groupBy<GE extends string>(
    field: GroupModeOnly<
      GroupMode,
      "ordinary",
      GE & GroupableFieldName<DB, TB, GE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  >;

  groupBy<
    Expression extends DateFunctionExpression<
      unknown,
      unknown,
      ComparisonOperator,
      string
    >,
  >(
    expression: GroupModeOnly<
      GroupMode,
      "ordinary",
      (eb: SelectExpressionBuilder<DB, TB>) => Expression
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | DateFunctionIdentityOf<Expression>,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  >;

  groupBy<GE extends string>(
    fields: GroupModeOnly<
      GroupMode,
      "ordinary",
      ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  >;

  groupByRollup<const Input extends AdvancedGroupByInput>(
    fields: GroupModeOnly<
      GroupMode,
      "rollup",
      AdvancedGroupByArgument<DB, TB, AdvancedFieldCount, Input>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | AdvancedGroupByField<Input>,
    NextGroupMode<GroupMode, "rollup">,
    NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
  >;

  groupByCube<const Input extends AdvancedGroupByInput>(
    fields: GroupModeOnly<
      GroupMode,
      "cube",
      AdvancedGroupByArgument<DB, TB, AdvancedFieldCount, Input>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | AdvancedGroupByField<Input>,
    NextGroupMode<GroupMode, "cube">,
    NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
  >;

  having(
    expression: GroupedOnly<
      GroupedBy,
      HavingExpressionFactory<
        DB,
        TB,
        GroupedBy,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  having<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false, false>,
  >(
    lhs: RE &
      GroupedOnly<GroupedBy, GroupedHavingFieldName<DB, TB, GroupedBy, RE>>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  limit(
    limit: GroupedOnly<GroupedBy, number>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  orderBy<OE extends string>(
    field: OE &
      GroupedOnly<GroupedBy, GroupedSortableFieldName<DB, TB, GroupedBy, OE>>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  orderBy(
    expression: AdvancedGroupingOnly<
      GroupMode,
      GroupingOrderByExpressionFactory<DB, TB, GroupedBy>
    >,
    direction?: OrderByDirection,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  orderBy<Output, Value, Operator extends ComparisonOperator>(
    expression: GroupedOnly<
      GroupedBy,
      (
        eb: SelectExpressionBuilder<DB, TB>,
      ) => AggregateFunctionBuilder<Output, Value, Operator>
    >,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  orderBy<
    Output,
    Value,
    Operator extends ComparisonOperator,
    Identity extends GroupedBy,
  >(
    expression: GroupedOnly<
      GroupedBy,
      (
        eb: SelectExpressionBuilder<DB, TB>,
      ) => DateFunctionExpression<Output, Value, Operator, Identity>
    >,
    direction?: OrderByDirection,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  select<Aggregate extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<
        DB,
        TB,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >,
    ) => Aggregate,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Aggregate>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  select<Selection extends GroupedSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<
        DB,
        TB,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >,
    ) => Selection &
      GroupedFunctionSelection<DB, TB, Selection, GroupedBy, GroupMode>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Selection>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  select<SE extends string>(
    selections: ReadonlyArray<
      SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & GroupedSelection<DB, TB, SE, GroupMode>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  select<SE extends string>(
    selection: SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & GroupedSelection<DB, TB, SE, GroupMode>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  toOperationNode(): SelectQueryNode;
}

class AggregateSelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  GroupedBy extends string,
  GroupMode extends AggregateGroupMode,
  AdvancedFieldCount extends AdvancedGroupFieldCount,
> implements
    AggregateSelectQueryBuilder<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >
{
  readonly #props: AggregateSelectQueryBuilderProps;

  constructor(props: AggregateSelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $if<O2>(
    condition: boolean,
    func: (
      qb: this,
    ) => AggregateSelectQueryBuilder<
      DB,
      TB,
      O & O2,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    ConditionalOutput<O, O2>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return (condition ? func(this) : this) as AggregateSelectQueryBuilder<
      DB,
      TB,
      ConditionalOutput<O, O2>,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >;
  }

  clearGroupBy(): AggregateSelectQueryBuilder<DB, TB, O, never, "none", 0> {
    assertCanClearGroupBy(this.#props.queryNode);

    return new AggregateSelectQueryBuilderImpl<DB, TB, O, never, "none", 0>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutGroupBy(this.#props.queryNode),
    });
  }

  clearLimit(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearOrderBy(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOrderBy(this.#props.queryNode),
    });
  }

  clearSelect(): AggregateSelectQueryBuilder<
    DB,
    TB,
    unknown,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      unknown,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutSelections(this.#props.queryNode),
    });
  }

  clearWhere(): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  async execute(): Promise<readonly O[]> {
    if (!this.#props.queryExecutor) {
      throw new Error(
        "No query executor configured. Pass an executor when creating Kysoql.",
      );
    }

    return this.#props.queryExecutor.executeQuery(this.compile());
  }

  async executeAll(): Promise<readonly O[]> {
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

    return this.#props.queryExecutor.executeAllQuery(this.compile());
  }

  apex(): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return createApexAggregateSelectQueryBuilder<DB, TB, O>(this.#props);
  }

  forView(
    ..._mruCheck: SalesforceObjectMruEnabled<DB[TB]> extends false
      ? readonly [mruDisabled: never]
      : readonly []
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
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
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForViewReference(
        this.#props.queryNode,
        ForViewReferenceNode.create("reference"),
      ),
    });
  }

  updateTracking(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "tracking",
      ),
    });
  }

  updateViewstat(
    ..._knowledgeArticleCheck: KnowledgeArticleUpdateCheck<TB>
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithKnowledgeUpdateMode(
        this.#props.queryNode,
        "viewstat",
      ),
    });
  }

  usingScope(
    scope: SalesforceObjectSupportedScope<DB[TB]>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
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
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithUserProfileFeedWith(
        this.#props.queryNode,
        parseUserProfileFeedWithUserId(userId),
      ),
    });
  }

  withRecordVisibilityContext(
    parameters: RecordVisibilityContextOptions,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithRecordVisibilityContext(
        this.#props.queryNode,
        parseRecordVisibilityContext(parameters),
      ),
    });
  }

  withDataCategory<Group extends SalesforceObjectDataCategoryGroup<DB[TB]>>(
    group: Group,
    selector: DataCategorySelector,
    categories: DataCategoryInput<SalesforceObjectDataCategory<DB[TB], Group>>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithDataCategorySelection(
        this.#props.queryNode,
        parseDataCategorySelection(group, selector, categories),
      ),
    });
  }

  groupBy<GE extends string>(
    field: GroupModeOnly<
      GroupMode,
      "ordinary",
      GE & GroupableFieldName<DB, TB, GE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  >;
  groupBy<GE extends string>(
    fields: GroupModeOnly<
      GroupMode,
      "ordinary",
      ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  >;
  groupBy<
    Expression extends DateFunctionExpression<
      unknown,
      unknown,
      ComparisonOperator,
      string
    >,
  >(
    expression: GroupModeOnly<
      GroupMode,
      "ordinary",
      (eb: SelectExpressionBuilder<DB, TB>) => Expression
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | DateFunctionIdentityOf<Expression>,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
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
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  > {
    const parsed =
      typeof groupBy === "function"
        ? [
            parseDateGroupByExpression(
              groupBy(createSelectExpressionBuilder<DB, TB>()) as never,
            ),
          ]
        : parseGroupBy(groupBy);

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy | GE,
      NextGroupMode<GroupMode, "ordinary">,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithGroupByItems(
        this.#props.queryNode,
        parsed,
      ),
    });
  }

  groupByRollup<const Input extends AdvancedGroupByInput>(
    groupBy: GroupModeOnly<
      GroupMode,
      "rollup",
      AdvancedGroupByArgument<DB, TB, AdvancedFieldCount, Input>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | AdvancedGroupByField<Input>,
    NextGroupMode<GroupMode, "rollup">,
    NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
  > {
    const parsed = parseAdvancedGroupBy(
      groupBy as string | readonly string[],
      "rollup",
      this.#props.queryNode.groupBy?.items.length ?? 0,
    );

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy | AdvancedGroupByField<Input>,
      NextGroupMode<GroupMode, "rollup">,
      NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithGroupByItems(
        this.#props.queryNode,
        parsed,
        "rollup",
      ),
    });
  }

  groupByCube<const Input extends AdvancedGroupByInput>(
    groupBy: GroupModeOnly<
      GroupMode,
      "cube",
      AdvancedGroupByArgument<DB, TB, AdvancedFieldCount, Input>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | AdvancedGroupByField<Input>,
    NextGroupMode<GroupMode, "cube">,
    NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
  > {
    const parsed = parseAdvancedGroupBy(
      groupBy as string | readonly string[],
      "cube",
      this.#props.queryNode.groupBy?.items.length ?? 0,
    );

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy | AdvancedGroupByField<Input>,
      NextGroupMode<GroupMode, "cube">,
      NextAdvancedGroupFieldCount<AdvancedFieldCount, Input>
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithGroupByItems(
        this.#props.queryNode,
        parsed,
        "cube",
      ),
    });
  }

  having(
    expression: GroupedOnly<
      GroupedBy,
      HavingExpressionFactory<
        DB,
        TB,
        GroupedBy,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  having<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false, false>,
  >(
    lhs: RE &
      GroupedOnly<GroupedBy, GroupedHavingFieldName<DB, TB, GroupedBy, RE>>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  having(
    lhsOrExpression:
      | string
      | HavingExpressionFactory<
          DB,
          TB,
          GroupedBy,
          AdvancedGroupingFields<GroupedBy, GroupMode>
        >,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    assertGroupedQuery(this.#props.queryNode);

    const groupedBy = getGroupedByIdentities(this.#props.queryNode);
    const groupingFields = getAdvancedGroupingFields(this.#props.queryNode);
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createHavingExpressionBuilder<
              DB,
              TB,
              GroupedBy,
              AdvancedGroupingFields<GroupedBy, GroupMode>
            >({ groupedBy, groupingFields }),
          ).toOperationNode()
        : createHavingExpressionBuilder<
            DB,
            TB,
            GroupedBy,
            AdvancedGroupingFields<GroupedBy, GroupMode>
          >({ groupedBy, groupingFields })(
            lhsOrExpression as never,
            op as never,
            rhs as never,
          ).toOperationNode();

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithHaving(
        this.#props.queryNode,
        operation,
      ),
    });
  }

  limit(
    limit: GroupedOnly<GroupedBy, number>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    assertGroupedQuery(this.#props.queryNode);

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  orderBy<OE extends string>(
    field: OE &
      GroupedOnly<GroupedBy, GroupedSortableFieldName<DB, TB, GroupedBy, OE>>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;

  orderBy(
    expression: AdvancedGroupingOnly<
      GroupMode,
      GroupingOrderByExpressionFactory<DB, TB, GroupedBy>
    >,
    direction?: OrderByDirection,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  orderBy<Output, Value, Operator extends ComparisonOperator>(
    expression: GroupedOnly<
      GroupedBy,
      (
        eb: SelectExpressionBuilder<DB, TB>,
      ) => AggregateFunctionBuilder<Output, Value, Operator>
    >,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  orderBy<
    Output,
    Value,
    Operator extends ComparisonOperator,
    Identity extends GroupedBy,
  >(
    expression: GroupedOnly<
      GroupedBy,
      (
        eb: SelectExpressionBuilder<DB, TB>,
      ) => DateFunctionExpression<Output, Value, Operator, Identity>
    >,
    direction?: OrderByDirection,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  orderBy(
    fieldOrExpression:
      | string
      | GroupingOrderByExpressionFactory<DB, TB, GroupedBy>
      | AggregateOrderByExpressionFactory<DB, TB>
      | ((
          eb: SelectExpressionBuilder<DB, TB>,
        ) => DateFunctionExpression<
          unknown,
          unknown,
          ComparisonOperator,
          string
        >),
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    assertGroupedQuery(this.#props.queryNode);

    let item: OrderByItemNode;

    if (typeof fieldOrExpression === "function") {
      const groupingFields = getAdvancedGroupingFields(this.#props.queryNode);
      const expression = fieldOrExpression(
        createSelectExpressionBuilder<DB, TB, GroupedBy>({ groupingFields }),
      );

      const node = expression.toOperationNode();

      if (node.kind === "DateFunctionNode") {
        validateGroupedDateFunctionNode(
          node,
          getGroupedByIdentities(this.#props.queryNode),
        );
        item = OrderByItemNode.create(node, direction);
      } else if (
        node.kind === "AggregateFunctionNode" &&
        node.function === "grouping"
      ) {
        item = parseGroupingOrderBy(
          expression as GroupingFunctionBuilder,
          requireAdvancedGroupingFields(this.#props.queryNode),
          direction,
        );
      } else {
        item = parseAggregateOrderBy(
          expression as AggregateFunctionExpression<unknown>,
          direction,
          nulls,
        );
      }
    } else {
      assertGroupedField(this.#props.queryNode, fieldOrExpression, "ORDER BY");
      item = parseOrderBy(fieldOrExpression, direction, nulls);
    }

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        item,
      ]),
    });
  }

  select<Aggregate extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<
        DB,
        TB,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >,
    ) => Aggregate,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Aggregate>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  select<Selection extends GroupedSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<
        DB,
        TB,
        AdvancedGroupingFields<GroupedBy, GroupMode>
      >,
    ) => Selection &
      GroupedFunctionSelection<DB, TB, Selection, GroupedBy, GroupMode>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Selection>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  select<SE extends string>(
    selections: ReadonlyArray<
      SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & GroupedSelection<DB, TB, SE, GroupMode>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  select<SE extends string>(
    selection: SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & GroupedSelection<DB, TB, SE, GroupMode>,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  select(
    selection:
      | string
      | readonly string[]
      | ((
          eb: SelectExpressionBuilder<
            DB,
            TB,
            AdvancedGroupingFields<GroupedBy, GroupMode>
          >,
        ) => GroupedSelectionArg),
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    unknown,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
    if (typeof selection !== "function") {
      validateGroupedSelections(this.#props.queryNode, selection);

      return new AggregateSelectQueryBuilderImpl<
        DB,
        TB,
        unknown,
        GroupedBy,
        GroupMode,
        AdvancedFieldCount
      >({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(
          this.#props.queryNode,
          parseSelectArg(selection),
        ),
      });
    }

    const groupingFields = getAdvancedGroupingFields(this.#props.queryNode);
    const parsedSelections = parseAggregateSelectArg(
      selection(
        createSelectExpressionBuilder<
          DB,
          TB,
          AdvancedGroupingFields<GroupedBy, GroupMode>
        >({ groupingFields }),
      ),
    );

    validateUniqueAliases(this.#props.queryNode, parsedSelections);
    validateGroupingSelections(parsedSelections, groupingFields);
    validateDateFunctionSelections(
      parsedSelections,
      getGroupedByIdentities(this.#props.queryNode),
      this.#props.queryNode.groupBy?.mode === undefined,
    );

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      unknown,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parsedSelections,
      ),
    });
  }

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  >;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy,
    GroupMode,
    AdvancedFieldCount
  > {
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

    return new AggregateSelectQueryBuilderImpl<
      DB,
      TB,
      O,
      GroupedBy,
      GroupMode,
      AdvancedFieldCount
    >({
      ...this.#props,
      queryNode,
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export interface AggregateSelectQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
}

export function createAggregateSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: AggregateSelectQueryBuilderProps,
): AggregateSelectQueryBuilder<DB, TB, O> {
  return new AggregateSelectQueryBuilderImpl<DB, TB, O, never, "none", 0>(
    props,
  );
}

export function createGroupedSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  GroupedBy extends string,
>(
  props: AggregateSelectQueryBuilderProps,
): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy, "ordinary", 0> {
  return new AggregateSelectQueryBuilderImpl<
    DB,
    TB,
    O,
    GroupedBy,
    "ordinary",
    0
  >(props);
}

function validateUniqueAliases(
  queryNode: SelectQueryNode,
  selections: readonly SelectionNode[],
): void {
  const aliases = new Set<string>();

  for (const selection of queryNode.selections ?? []) {
    if (selection.selection.kind === "AliasNode") {
      aliases.add(selection.selection.alias);
    }
  }

  for (const selection of selections) {
    if (selection.selection.kind !== "AliasNode") {
      continue;
    }

    if (aliases.has(selection.selection.alias)) {
      throw new TypeError(
        `Duplicate SOQL aggregate selection alias: ${selection.selection.alias}.`,
      );
    }

    aliases.add(selection.selection.alias);
  }
}

function assertGroupedQuery(queryNode: SelectQueryNode): void {
  if (!queryNode.groupBy?.items.length) {
    throw new TypeError(
      "SOQL aggregate queries must use GROUP BY before this clause.",
    );
  }
}

function assertGroupedField(
  queryNode: SelectQueryNode,
  field: string,
  clause: "ORDER BY" | "SELECT",
): void {
  assertGroupedQuery(queryNode);

  if (
    !queryNode.groupBy?.items.some(
      (item) => item.kind === "ReferenceNode" && item.name === field,
    )
  ) {
    throw new TypeError(
      `SOQL aggregate ${clause} fields must also appear in GROUP BY.`,
    );
  }
}

function getGroupedByIdentities(queryNode: SelectQueryNode): readonly string[] {
  return (
    queryNode.groupBy?.items.map((item) =>
      item.kind === "ReferenceNode" ? item.name : dateFunctionIdentity(item),
    ) ?? []
  );
}

function validateGroupedSelections(
  queryNode: SelectQueryNode,
  selection: string | readonly string[],
): void {
  const fields = Array.isArray(selection) ? selection : [selection];

  for (const field of fields) {
    assertGroupedField(queryNode, field, "SELECT");
  }
}

function getAdvancedGroupingFields(
  queryNode: SelectQueryNode,
): readonly string[] {
  return queryNode.groupBy?.mode
    ? queryNode.groupBy.items.map((item) => {
        if (item.kind !== "ReferenceNode") {
          throw new TypeError(
            "SOQL date grouping functions are supported only by ordinary GROUP BY.",
          );
        }

        return item.name;
      })
    : [];
}

function requireAdvancedGroupingFields(
  queryNode: SelectQueryNode,
): readonly string[] {
  const fields = getAdvancedGroupingFields(queryNode);

  if (fields.length === 0) {
    throw new TypeError(
      "SOQL GROUPING() is available only for fields in GROUP BY ROLLUP or GROUP BY CUBE.",
    );
  }

  return fields;
}
