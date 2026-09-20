import type { ApexBindExpression } from "#/apex-bind";
import {
  createApexExpressionBuilder,
  type ApexWhereExpressionFactory,
} from "#/expression/apex-expression-builder";
import {
  type ApexAccessMode,
  ApexAccessModeNode,
} from "#/operation-node/apex-access-mode-node";
import { ForUpdateNode } from "#/operation-node/for-update-node";
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
import type { SelectQueryBuilderProps } from "#/query-builder/select-query-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import { freeze } from "#/util/object-utils";

export interface ApexSelectQueryBuilder<DB, TB extends keyof DB, O> {
  compile(): CompiledQuery<O>;

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O>;

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O>;

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O>;

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O>;

  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O>;

  withUserMode(): ApexSelectQueryBuilder<DB, TB, O>;

  toOperationNode(): SelectQueryNode;
}

class ApexSelectQueryBuilderImpl<DB, TB extends keyof DB, O>
  implements ApexSelectQueryBuilder<DB, TB, O>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForUpdate(
        this.#props.queryNode,
        ForUpdateNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseApexOffset(offset),
      ),
    });
  }

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O>;
  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O>;
  where(
    lhsOrExpression: string | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexSelectQueryBuilder<DB, TB, O> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createApexExpressionBuilder<DB, TB>(
              this.#props.queryNode.from.name,
            ),
          ).toOperationNode()
        : parseApexFilterBinaryOperation(
            lhsOrExpression,
            op as ComparisonOperator,
            rhs,
            this.#props.queryNode.from.name,
          );
    const queryNode = QueryNode.cloneWithWhere(this.#props.queryNode, operation);

    validateSemiJoinWhere(queryNode.where?.where ?? operation);

    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode,
    });
  }

  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexSelectQueryBuilder<DB, TB, O> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(mode: ApexAccessMode): ApexSelectQueryBuilder<DB, TB, O> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O>({
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

export function createApexSelectQueryBuilder<DB, TB extends keyof DB, O>(
  props: SelectQueryBuilderProps,
): ApexSelectQueryBuilder<DB, TB, O> {
  return new ApexSelectQueryBuilderImpl<DB, TB, O>(props);
}
