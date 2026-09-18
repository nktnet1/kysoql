import {
  type CountAllFunctionBuilder,
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
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
import { validateDateFunctionSelections } from "#/parser/date-function-parser";
import {
  parseFilterBinaryOperation,
  validateSemiJoinWhere,
} from "#/parser/filter-parser";
import { validateGroupingSelections } from "#/parser/grouping-expression-parser";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import { parseOrderBy, type SortableFieldName } from "#/parser/order-by-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import {
  parseSelectArg,
  type SelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  type AggregateSelectQueryBuilder,
  createAggregateSelectQueryBuilder,
} from "#/query-builder/aggregate-select-query-builder";
import {
  type CountQueryBuilder,
  createCountQueryBuilder,
} from "#/query-builder/count-query-builder";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#/query-builder/relationship-subquery-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import type { SalesforceQueryResult } from "#/schema";
import { freeze } from "#/util/object-utils";
import type { Simplify } from "#/util/type-utils";

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

export interface SelectQueryBuilder<DB, TB extends keyof DB, O> {
  compile(): CompiledQuery<O>;

  execute(): Promise<readonly O[]>;

  limit(limit: number): SelectQueryBuilder<DB, TB, O>;

  offset(offset: number): SelectQueryBuilder<DB, TB, O>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O>;

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O>;

  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;

  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;

  select<SE extends string>(
    selections: ReadonlyArray<SE & SelectExpression<DB, TB, SE>>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>;

  select<SE extends string>(
    selection: SE & SelectExpression<DB, TB, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>;

  selectSubquery<Relationship extends string, SubqueryOutput>(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown]
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown]
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    }
  >;

  toOperationNode(): SelectQueryNode;
}

class SelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements SelectQueryBuilder<DB, TB, O>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
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

  limit(limit: number): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  offset(offset: number): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseOffset(offset),
      ),
    });
  }

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): SelectQueryBuilder<DB, TB, O> {
    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOrderByItems(this.#props.queryNode, [
        parseOrderBy(field, direction, nulls),
      ]),
    });
  }

  where(
    expression: WhereExpressionFactory<DB, TB>,
  ): SelectQueryBuilder<DB, TB, O>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): SelectQueryBuilder<DB, TB, O>;
  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): SelectQueryBuilder<DB, TB, O> {
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

    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode,
    });
  }

  select(
    selection: UnselectedOnly<O, CountSelectionFactory<DB, TB>>,
  ): CountQueryBuilder<DB, TB>;
  select<Aggregate extends AggregateSelectionArg>(
    selection: UnselectedOnly<O, AggregateSelectionFactory<DB, TB, Aggregate>>,
  ): AggregateSelectQueryBuilder<DB, TB, AggregateSelection<Aggregate>>;
  select<SE extends string>(
    selection: SelectArg<DB, TB, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>>;
  select(
    selection:
      | string
      | readonly string[]
      | ((eb: SelectExpressionBuilder<DB, TB>) => unknown),
  ):
    | AggregateSelectQueryBuilder<DB, TB, unknown>
    | CountQueryBuilder<DB, TB>
    | SelectQueryBuilder<DB, TB, unknown> {
    if (typeof selection !== "function") {
      return new SelectQueryBuilderImpl<DB, TB, unknown>({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(
          this.#props.queryNode,
          parseSelectArg(selection),
        ),
      });
    }

    assertNoExistingSelections(this.#props.queryNode);

    const aggregate = selection(createSelectExpressionBuilder<DB, TB>());

    if (isCountAllFunctionBuilder(aggregate)) {
      assertCountClauses(this.#props.queryNode);

      return createCountQueryBuilder<DB, TB>({
        ...this.#props,
        queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
          parseCountSelectArg(aggregate),
        ]),
      });
    }

    assertAggregateClauses(this.#props.queryNode);

    const selections = parseAggregateSelectArg(
      aggregate as AggregateSelectionArg,
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

  selectSubquery<Relationship extends string, SubqueryOutput>(
    relationship: Relationship &
      ChildRelationshipReference<DB, TB, Relationship>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown]
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown]
    >,
  ): SelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    }
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        readonly [unknown]
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
      }),
    );

    return new SelectQueryBuilderImpl<
      DB,
      TB,
      O & {
        readonly [Key in Relationship]: SalesforceQueryResult<
          Simplify<SubqueryOutput>
        >;
      }
    >({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(this.#props.queryNode, [
        SelectionNode.create(subquery.toOperationNode()),
      ]),
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export interface SelectQueryBuilderProps {
  readonly queryCompiler: QueryCompiler;
  readonly queryExecutor: QueryExecutor | undefined;
  readonly queryNode: SelectQueryNode;
}

export function createSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: SelectQueryBuilderProps,
): SelectQueryBuilder<DB, TB, O> {
  return new SelectQueryBuilderImpl(props);
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
      "Start SOQL aggregate mode before selecting grouped record fields.",
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
