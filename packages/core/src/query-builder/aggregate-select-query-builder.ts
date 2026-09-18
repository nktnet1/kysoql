import {
  createSelectExpressionBuilder,
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
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
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
  parseGroupBy,
} from "#/parser/group-by-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
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

type GroupedOnly<GroupedBy extends string, Value> = [GroupedBy] extends [never]
  ? never
  : Value;

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

export interface AggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  GroupedBy extends string = never,
> {
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  groupBy<GE extends string>(
    field: GE & GroupableFieldName<DB, TB, GE>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy | GE>;

  groupBy<GE extends string>(
    fields: ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy | GE>;

  having(
    expression: GroupedOnly<
      GroupedBy,
      HavingExpressionFactory<DB, TB, GroupedBy>
    >,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

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
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

  limit(
    limit: GroupedOnly<GroupedBy, number>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

  orderBy<OE extends string>(
    field: OE &
      GroupedOnly<
        GroupedBy,
        GroupedSortableFieldName<DB, TB, GroupedBy, OE>
      >,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

  select<Aggregate extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<DB, TB>,
    ) => Aggregate,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Aggregate>,
    GroupedBy
  >;

  select<SE extends string>(
    selections: ReadonlyArray<
      SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    GroupedBy
  >;

  select<SE extends string>(
    selection: SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    GroupedBy
  >;

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;

  toOperationNode(): SelectQueryNode;
}

class AggregateSelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  GroupedBy extends string,
> implements AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>
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
    groupBy:
      | (GE & GroupableFieldName<DB, TB, GE>)
      | ReadonlyArray<GE & GroupableFieldName<DB, TB, GE>>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy | GE> {
    return new AggregateSelectQueryBuilderImpl<DB, TB, O, GroupedBy | GE>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithGroupByItems(
        this.#props.queryNode,
        parseGroupBy(groupBy),
      ),
    });
  }

  having(
    expression: GroupedOnly<
      GroupedBy,
      HavingExpressionFactory<DB, TB, GroupedBy>
    >,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;
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
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;
  having(
    lhsOrExpression:
      | string
      | HavingExpressionFactory<DB, TB, GroupedBy>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy> {
    assertGroupedQuery(this.#props.queryNode);

    const groupedBy = this.#props.queryNode.groupBy?.items.map(
      (item) => item.name,
    ) ?? [];
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createHavingExpressionBuilder<DB, TB, GroupedBy>({ groupedBy }),
          ).toOperationNode()
        : createHavingExpressionBuilder<DB, TB, GroupedBy>({ groupedBy })(
            lhsOrExpression as never,
            op as never,
            rhs as never,
          ).toOperationNode();

    return new AggregateSelectQueryBuilderImpl<DB, TB, O, GroupedBy>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithHaving(
        this.#props.queryNode,
        operation,
      ),
    });
  }

  limit(
    limit: GroupedOnly<GroupedBy, number>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy> {
    assertGroupedQuery(this.#props.queryNode);

    return new AggregateSelectQueryBuilderImpl<DB, TB, O, GroupedBy>({
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
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy> {
    assertGroupedField(this.#props.queryNode, field, "ORDER BY");

    return new AggregateSelectQueryBuilderImpl<DB, TB, O, GroupedBy>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        parseOrderBy(field, direction, nulls),
      ]),
    });
  }

  select<Aggregate extends AggregateSelectionArg>(
    selection: (
      eb: SelectExpressionBuilder<DB, TB>,
    ) => Aggregate,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & AggregateSelection<Aggregate>,
    GroupedBy
  >;
  select<SE extends string>(
    selections: ReadonlyArray<
      SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>
    >,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    GroupedBy
  >;
  select<SE extends string>(
    selection: SE & GroupedSelectExpression<DB, TB, GroupedBy, SE>,
  ): AggregateSelectQueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    GroupedBy
  >;
  select(
    selection:
      | string
      | readonly string[]
      | ((eb: SelectExpressionBuilder<DB, TB>) => AggregateSelectionArg),
  ): AggregateSelectQueryBuilder<DB, TB, unknown, GroupedBy> {
    if (typeof selection !== "function") {
      validateGroupedSelections(this.#props.queryNode, selection);

      return new AggregateSelectQueryBuilderImpl<DB, TB, unknown, GroupedBy>({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(
          this.#props.queryNode,
          parseSelectArg(selection),
        ),
      });
    }

    const parsedSelections = parseAggregateSelectArg(
      selection(createSelectExpressionBuilder<DB, TB>()),
    );

    validateUniqueAliases(this.#props.queryNode, parsedSelections);

    return new AggregateSelectQueryBuilderImpl<DB, TB, unknown, GroupedBy>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parsedSelections,
      ),
    });
  }

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy>;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): AggregateSelectQueryBuilder<DB, TB, O, GroupedBy> {
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

    return new AggregateSelectQueryBuilderImpl<DB, TB, O, GroupedBy>({
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
  return new AggregateSelectQueryBuilderImpl<DB, TB, O, never>(props);
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
