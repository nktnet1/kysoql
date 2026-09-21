import type { ApexBindExpression } from "#/apex-bind";
import {
  type ApexWhereExpressionFactory,
  createApexExpressionBuilder,
} from "#/expression/apex-expression-builder";
import { AllRowsNode } from "#/operation-node/all-rows-node";
import {
  type ApexAccessMode,
  ApexAccessModeNode,
} from "#/operation-node/apex-access-mode-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import {
  type ApexOperandValueExpression,
  parseApexFilterBinaryOperation,
  parseApexLimit,
  parseApexOffset,
} from "#/parser/apex-bind-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
} from "#/parser/binary-operation-parser";
import { validateSemiJoinWhere } from "#/parser/filter-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { freeze } from "#/util/object-utils";

interface ApexAggregateSelectQueryBuilderProps {
  readonly queryNode: SelectQueryNode;
  readonly queryCompiler: QueryCompiler;
}

export interface ApexAggregateSelectQueryBuilder<DB, TB extends keyof DB, O> {
  $call<T>(func: (qb: this) => T): T;

  $if(condition: boolean, func: (qb: this) => this): this;

  clearWhere(): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  compile(): CompiledQuery<O>;

  allRows(): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  withSystemMode(): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  withUserMode(): ApexAggregateSelectQueryBuilder<DB, TB, O>;

  toOperationNode(): SelectQueryNode;
}

class ApexAggregateSelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements ApexAggregateSelectQueryBuilder<DB, TB, O>
{
  readonly #props: ApexAggregateSelectQueryBuilderProps;

  constructor(props: ApexAggregateSelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $if(condition: boolean, func: (qb: this) => this): this {
    return condition ? func(this) : this;
  }

  clearWhere(): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  allRows(): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithAllRows(
        this.#props.queryNode,
        AllRowsNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseApexOffset(offset),
      ),
    });
  }

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createApexExpressionBuilder<DB, TB>({
              outerObject: this.#props.queryNode.from.name,
            }),
          ).toOperationNode()
        : parseApexFilterBinaryOperation(
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

    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode,
    });
  }

  withSystemMode(): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(
    mode: ApexAccessMode,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithApexAccessMode(
        this.#props.queryNode,
        ApexAccessModeNode.create(mode),
      ),
    });
  }

  toOperationNode(): SelectQueryNode {
    return this.#props.queryNode;
  }
}

export function createApexAggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
>(
  props: ApexAggregateSelectQueryBuilderProps,
): ApexAggregateSelectQueryBuilder<DB, TB, O> {
  return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O>(props);
}
