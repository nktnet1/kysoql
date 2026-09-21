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
} from "#/parser/apex-bind-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
} from "#/parser/binary-operation-parser";
import { validateSemiJoinWhere } from "#/parser/filter-parser";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { freeze } from "#/util/object-utils";

interface ApexCountQueryBuilderProps {
  readonly queryNode: SelectQueryNode;
  readonly queryCompiler: QueryCompiler;
}

export interface ApexCountQueryBuilder<DB, TB extends keyof DB> {
  $call<T>(func: (qb: this) => T): T;

  $if(condition: boolean, func: (qb: this) => this): this;

  clearLimit(): ApexCountQueryBuilder<DB, TB>;

  clearWhere(): ApexCountQueryBuilder<DB, TB>;

  compile(): CompiledQuery<number>;

  allRows(): ApexCountQueryBuilder<DB, TB>;

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexCountQueryBuilder<DB, TB>;

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexCountQueryBuilder<DB, TB>;

  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexCountQueryBuilder<DB, TB>;

  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexCountQueryBuilder<DB, TB>;

  withSystemMode(): ApexCountQueryBuilder<DB, TB>;

  withUserMode(): ApexCountQueryBuilder<DB, TB>;

  toOperationNode(): SelectQueryNode;
}

class ApexCountQueryBuilderImpl<DB, TB extends keyof DB>
  implements ApexCountQueryBuilder<DB, TB>
{
  readonly #props: ApexCountQueryBuilderProps;

  constructor(props: ApexCountQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $if(condition: boolean, func: (qb: this) => this): this {
    return condition ? func(this) : this;
  }

  clearLimit(): ApexCountQueryBuilder<DB, TB> {
    return new ApexCountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearWhere(): ApexCountQueryBuilder<DB, TB> {
    return new ApexCountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<number> {
    return this.#props.queryCompiler.compileQuery<number>(
      this.#props.queryNode,
      { apex: true },
    );
  }

  allRows(): ApexCountQueryBuilder<DB, TB> {
    return new ApexCountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithAllRows(
        this.#props.queryNode,
        AllRowsNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexCountQueryBuilder<DB, TB> {
    return new ApexCountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexCountQueryBuilder<DB, TB>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexCountQueryBuilder<DB, TB>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexCountQueryBuilder<DB, TB>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexCountQueryBuilder<DB, TB> {
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

    return new ApexCountQueryBuilderImpl<DB, TB>({
      ...this.#props,
      queryNode,
    });
  }

  withSystemMode(): ApexCountQueryBuilder<DB, TB> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexCountQueryBuilder<DB, TB> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(mode: ApexAccessMode): ApexCountQueryBuilder<DB, TB> {
    return new ApexCountQueryBuilderImpl<DB, TB>({
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

export function createApexCountQueryBuilder<DB, TB extends keyof DB>(
  props: ApexCountQueryBuilderProps,
): ApexCountQueryBuilder<DB, TB> {
  return new ApexCountQueryBuilderImpl<DB, TB>(props);
}
