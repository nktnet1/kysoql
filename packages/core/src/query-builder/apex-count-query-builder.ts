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
} from "#/parser/apex-bind-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
} from "#/parser/binary-operation-parser";
import { validateSemiJoinWhere } from "#/parser/filter-parser";
import { parseDynamicApexSetOptions } from "#/parser/set-options-parser";
import type {
  ApexQueryContext,
  DynamicApexOnly,
} from "#/query-builder/apex-query-context";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryId } from "#/query-id";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#/soql";
import { freeze } from "#/util/object-utils";

interface ApexCountQueryBuilderProps {
  readonly queryId: QueryId;
  readonly queryNode: SelectQueryNode;
  readonly queryNodeTransformer?: (query: SelectQueryNode) => SelectQueryNode;
  readonly queryCompiler: QueryCompiler;
  readonly apexContext: ApexQueryContext;
}

/** Apex rendering wrapper for a COUNT() query. */
export interface ApexCountQueryBuilder<
  DB,
  TB extends keyof DB,
  Context extends ApexQueryContext = "static",
> {
  /** Passes this builder to `func` and returns the callback result. */
  $call<T>(func: (qb: this) => T): T;

  /** Conditionally applies a builder callback; when false, the runtime query is unchanged. */
  $if(condition: boolean, func: (qb: this) => this): this;

  /** Returns a builder with the `LIMIT` clause removed. */
  clearLimit(): ApexCountQueryBuilder<DB, TB, Context>;

  /** Returns a builder with the `WHERE` predicate removed. */
  clearWhere(): ApexCountQueryBuilder<DB, TB, Context>;

  /** Compiles the current operation tree into a `CompiledQuery`. */
  compile(): CompiledQuery<number>;

  /** Adds the Apex `ALL ROWS` clause. */
  allRows(): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds or replaces the SOQL `LIMIT` clause. */
  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(expression: SoqlRawBuilder): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexCountQueryBuilder<DB, TB, Context>;

  /** Adds dynamic Apex `SET OPTIONS` from a bound `Database.QueryOptions` variable. */
  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexCountQueryBuilder<DB, TB, Context>;

  /** Compiles the Apex query with `WITH SYSTEM_MODE`. */
  withSystemMode(): ApexCountQueryBuilder<DB, TB, Context>;

  /** Compiles the Apex query with `WITH USER_MODE`. */
  withUserMode(): ApexCountQueryBuilder<DB, TB, Context>;

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): SelectQueryNode;
}

class ApexCountQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  Context extends ApexQueryContext,
> implements ApexCountQueryBuilder<DB, TB, Context>
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

  clearLimit(): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearWhere(): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<number> {
    return this.#props.queryCompiler.compileQuery<number>(
      this.#props.queryNode,
      {
        apex: true,
        dynamicApex: this.#props.apexContext === "dynamic",
        queryId: this.#props.queryId,
      },
    );
  }

  allRows(): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithAllRows(
        this.#props.queryNode,
        AllRowsNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  where(expression: SoqlRawBuilder): ApexCountQueryBuilder<DB, TB, Context>;
  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexCountQueryBuilder<DB, TB, Context>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexCountQueryBuilder<DB, TB, Context>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexCountQueryBuilder<DB, TB, Context>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | SoqlRawBuilder
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexCountQueryBuilder<DB, TB, Context> {
    const operation = isSoqlRawBuilder(lhsOrExpression)
      ? lhsOrExpression.toOperationNode()
      : typeof lhsOrExpression === "function"
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

    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode,
    });
  }

  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSetOptions(
        this.#props.queryNode,
        parseDynamicApexSetOptions(options),
      ),
    });
  }

  withSystemMode(): ApexCountQueryBuilder<DB, TB, Context> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexCountQueryBuilder<DB, TB, Context> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(
    mode: ApexAccessMode,
  ): ApexCountQueryBuilder<DB, TB, Context> {
    return new ApexCountQueryBuilderImpl<DB, TB, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithApexAccessMode(
        this.#props.queryNode,
        ApexAccessModeNode.create(mode),
      ),
    });
  }

  toOperationNode(): SelectQueryNode {
    return (
      this.#props.queryNodeTransformer?.(this.#props.queryNode) ??
      this.#props.queryNode
    );
  }
}

export function createApexCountQueryBuilder<DB, TB extends keyof DB>(
  props: Omit<ApexCountQueryBuilderProps, "apexContext">,
): ApexCountQueryBuilder<DB, TB, "static"> {
  return new ApexCountQueryBuilderImpl<DB, TB, "static">({
    ...props,
    apexContext: "static",
  });
}

export function createDynamicApexCountQueryBuilder<DB, TB extends keyof DB>(
  props: Omit<ApexCountQueryBuilderProps, "apexContext">,
): ApexCountQueryBuilder<DB, TB, "dynamic"> {
  return new ApexCountQueryBuilderImpl<DB, TB, "dynamic">({
    ...props,
    apexContext: "dynamic",
  });
}
