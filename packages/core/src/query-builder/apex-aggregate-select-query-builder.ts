import type { ApexBindExpression, ApexDatabaseQueryOptions } from "#/apex-bind";
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
import { assertCanClearGroupBy } from "#/parser/group-by-parser";
import { parseDynamicApexSetOptions } from "#/parser/set-options-parser";
import type {
  ApexQueryContext,
  DynamicApexOnly,
} from "#/query-builder/apex-query-context";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { freeze } from "#/util/object-utils";

interface ApexAggregateSelectQueryBuilderProps {
  readonly queryNode: SelectQueryNode;
  readonly queryCompiler: QueryCompiler;
  readonly apexContext: ApexQueryContext;
}

export interface ApexAggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Context extends ApexQueryContext = "static",
> {
  $call<T>(func: (qb: this) => T): T;

  $if(condition: boolean, func: (qb: this) => this): this;

  clearGroupBy(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  clearLimit(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  clearOffset(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  clearOrderBy(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  clearWhere(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  compile(): CompiledQuery<O>;

  allRows(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  withSystemMode(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  withUserMode(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;

  toOperationNode(): SelectQueryNode;
}

class ApexAggregateSelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Context extends ApexQueryContext,
> implements ApexAggregateSelectQueryBuilder<DB, TB, O, Context>
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

  clearGroupBy(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    assertCanClearGroupBy(this.#props.queryNode);

    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutGroupBy(this.#props.queryNode),
    });
  }

  clearLimit(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearOffset(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOffset(this.#props.queryNode),
    });
  }

  clearOrderBy(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOrderBy(this.#props.queryNode),
    });
  }

  clearWhere(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode, {
      apex: true,
      dynamicApex: this.#props.apexContext === "dynamic",
    });
  }

  allRows(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithAllRows(
        this.#props.queryNode,
        AllRowsNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseApexOffset(offset),
      ),
    });
  }

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
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

    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode,
    });
  }

  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSetOptions(
        this.#props.queryNode,
        parseDynamicApexSetOptions(options),
      ),
    });
  }

  withSystemMode(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(
    mode: ApexAccessMode,
  ): ApexAggregateSelectQueryBuilder<DB, TB, O, Context> {
    return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, Context>({
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
  props: Omit<ApexAggregateSelectQueryBuilderProps, "apexContext">,
): ApexAggregateSelectQueryBuilder<DB, TB, O, "static"> {
  return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, "static">({
    ...props,
    apexContext: "static",
  });
}

export function createDynamicApexAggregateSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
>(
  props: Omit<ApexAggregateSelectQueryBuilderProps, "apexContext">,
): ApexAggregateSelectQueryBuilder<DB, TB, O, "dynamic"> {
  return new ApexAggregateSelectQueryBuilderImpl<DB, TB, O, "dynamic">({
    ...props,
    apexContext: "dynamic",
  });
}
