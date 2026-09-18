import {
  createSelectExpressionBuilder,
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
import type { AdvancedGroupByMode } from "#/operation-node/group-by-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
  OrderByItemNode,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import {
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import {
  type AggregateSelection,
  type AggregateSelectionArg,
  parseAggregateSelectArg,
} from "#/parser/aggregate-selection-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import {
  type GroupableFieldName,
  parseAdvancedGroupBy,
  parseGroupBy,
} from "#/parser/group-by-parser";
import { validateGroupingSelections } from "#/parser/grouping-expression-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
  parseGroupingOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import { freeze } from "#/util/object-utils";

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
> = (
  eb: SelectExpressionBuilder<DB, TB, GroupedBy>,
) => GroupingFunctionBuilder;

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
> = Reference extends GroupedBy
  ? SortableFieldName<DB, TB, Reference>
  : never;

type GroupedSelection<
  DB,
  TB extends keyof DB,
  SE,
  GroupMode extends AggregateGroupMode,
> = Selection<
  DB,
  TB,
  SE,
  GroupMode extends AdvancedGroupByMode ? true : false
>;

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
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

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
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false>,
  >(
    lhs: RE &
      GroupedOnly<
        GroupedBy,
        GroupedHavingFieldName<DB, TB, GroupedBy, RE>
      >,
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
      GroupedOnly<
        GroupedBy,
        GroupedSortableFieldName<DB, TB, GroupedBy, OE>
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
  groupBy<GE extends string>(
    groupBy:
      | (GE & GroupableFieldName<DB, TB, GE>)
      | ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O,
    GroupedBy | GE,
    NextGroupMode<GroupMode, "ordinary">,
    AdvancedFieldCount
  > {
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
        parseGroupBy(groupBy),
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
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false>,
  >(
    lhs: RE &
      GroupedOnly<
        GroupedBy,
        GroupedHavingFieldName<DB, TB, GroupedBy, RE>
      >,
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

    const groupedBy =
      this.#props.queryNode.groupBy?.items.map((item) => item.name) ?? [];
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
      GroupedOnly<
        GroupedBy,
        GroupedSortableFieldName<DB, TB, GroupedBy, OE>
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
  orderBy(
    fieldOrExpression:
      | string
      | GroupingOrderByExpressionFactory<DB, TB, GroupedBy>,
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
      const groupingFields = requireAdvancedGroupingFields(
        this.#props.queryNode,
      );
      const expression = fieldOrExpression(
        createSelectExpressionBuilder<DB, TB, GroupedBy>({ groupingFields }),
      );

      item = parseGroupingOrderBy(expression, groupingFields, direction);
    } else {
      assertGroupedField(
        this.#props.queryNode,
        fieldOrExpression,
        "ORDER BY",
      );
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
        ) => AggregateSelectionArg),
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

export function createAggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
>(
  props: AggregateSelectQueryBuilderProps,
): AggregateSelectQueryBuilder<DB, TB, O> {
  return new AggregateSelectQueryBuilderImpl<DB, TB, O, never, "none", 0>(
    props,
  );
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

  if (!queryNode.groupBy?.items.some((item) => item.name === field)) {
    throw new TypeError(
      `SOQL aggregate ${clause} fields must also appear in GROUP BY.`,
    );
  }
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
    ? queryNode.groupBy.items.map((item) => item.name)
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
