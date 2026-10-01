import type {
  ApexBindExpression,
  ApexDatabaseQueryOptions,
} from "#src/apex-bind";
import {
  type ApexWhereExpressionFactory,
  createApexExpressionBuilder,
} from "#src/expression/apex-expression-builder";
import { AllRowsNode } from "#src/operation-node/all-rows-node";
import {
  type ApexAccessMode,
  ApexAccessModeNode,
} from "#src/operation-node/apex-access-mode-node";
import { ForUpdateNode } from "#src/operation-node/for-update-node";
import type { ComparisonOperator } from "#src/operation-node/operator-node";
import { QueryNode } from "#src/operation-node/query-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#src/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#src/operation-node/select-query-node";
import { SelectionNode } from "#src/operation-node/selection-node";
import {
  type ApexOperandValueExpression,
  parseApexFilterBinaryOperation,
  parseApexLimit,
  parseApexOffset,
} from "#src/parser/apex-bind-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
} from "#src/parser/binary-operation-parser";
import { validateSemiJoinWhere } from "#src/parser/filter-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#src/parser/reference-parser";
import { parseDynamicApexSetOptions } from "#src/parser/set-options-parser";
import { validateTypeOfSelections } from "#src/parser/type-of-parser";
import type {
  ApexQueryContext,
  DynamicApexOnly,
} from "#src/query-builder/apex-query-context";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#src/query-builder/relationship-subquery-builder";
import type {
  SelectQueryBuilderProps,
  SelectQueryMode,
} from "#src/query-builder/select-query-builder";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type { SalesforceQueryResult } from "#src/schema";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#src/soql";
import { freeze } from "#src/util/object-utils";
import type { ConditionalOutput, Simplify } from "#src/util/type-utils";

type ChildObjectForRelationship<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> = ChildObjectName<
  DB,
  TB,
  Extract<Relationship, ChildRelationshipName<DB, TB>>
>;

type AfterSelectFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "plain" ? "function" : Mode;

type AfterSubqueryMode<
  Mode extends SelectQueryMode,
  SubqueryFunctionMode extends "none" | "present" | "forbidden",
> = SubqueryFunctionMode extends "present"
  ? AfterSelectFunctionMode<Mode>
  : Mode;

type InitialSubqueryFunctionMode<Mode extends SelectQueryMode> =
  Mode extends "typeof" ? "forbidden" : "none";

interface ApexSelectQueryBuilderProps extends SelectQueryBuilderProps {
  readonly apexContext: ApexQueryContext;
}

/** Apex rendering wrapper for a typed SELECT query. */
export interface ApexSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = SelectQueryMode,
  Context extends ApexQueryContext = "static",
> {
  /** Passes this builder to `func` and returns the callback result. */
  $call<T>(func: (qb: this) => T): T;

  /** Conditionally applies a builder callback; when false, the runtime query is unchanged. */
  $if<O2>(
    condition: boolean,
    func: (qb: this) => ApexSelectQueryBuilder<DB, TB, O & O2, Mode, Context>,
  ): ApexSelectQueryBuilder<DB, TB, ConditionalOutput<O, O2>, Mode, Context>;

  /** Returns a builder with the `LIMIT` clause removed. */
  clearLimit(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Returns a builder with the `OFFSET` clause removed. */
  clearOffset(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Returns a builder with all `ORDER BY` items removed. */
  clearOrderBy(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Returns a builder with the `WHERE` predicate removed. */
  clearWhere(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Compiles the current operation tree into a `CompiledQuery`. */
  compile(): CompiledQuery<O>;

  /** Adds the Apex `ALL ROWS` clause. */
  allRows(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds `FOR UPDATE` so Salesforce locks the selected records. */
  forUpdate(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds or replaces the SOQL `LIMIT` clause. */
  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds or replaces the SOQL `OFFSET` clause. */
  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds a typed child-relationship subquery selection. */
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
        InitialSubqueryFunctionMode<Mode>,
        true
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode,
      true
    >,
  ): ApexSelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>,
    Context
  >;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    expression: SoqlRawBuilder,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Adds dynamic Apex `SET OPTIONS` from a bound `Database.QueryOptions` variable. */
  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Compiles the Apex query with `WITH SYSTEM_MODE`. */
  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Compiles the Apex query with `WITH USER_MODE`. */
  withUserMode(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): SelectQueryNode;
}

class ApexSelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
  Context extends ApexQueryContext,
> implements ApexSelectQueryBuilder<DB, TB, O, Mode, Context>
{
  readonly #props: ApexSelectQueryBuilderProps;

  constructor(props: ApexSelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $if<O2>(
    condition: boolean,
    func: (qb: this) => ApexSelectQueryBuilder<DB, TB, O & O2, Mode, Context>,
  ): ApexSelectQueryBuilder<DB, TB, ConditionalOutput<O, O2>, Mode, Context> {
    return (condition ? func(this) : this) as ApexSelectQueryBuilder<
      DB,
      TB,
      ConditionalOutput<O, O2>,
      Mode,
      Context
    >;
  }

  clearLimit(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
    });
  }

  clearOffset(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOffset(this.#props.queryNode),
    });
  }

  clearOrderBy(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithoutOrderBy(this.#props.queryNode),
    });
  }

  clearWhere(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode, {
      apex: true,
      dynamicApex: this.#props.apexContext === "dynamic",
      queryId: this.#props.queryId,
    });
  }

  allRows(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithAllRows(
        this.#props.queryNode,
        AllRowsNode.create(),
      ),
    });
  }

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForUpdate(
        this.#props.queryNode,
        ForUpdateNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseApexOffset(offset),
      ),
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
        InitialSubqueryFunctionMode<Mode>,
        true
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      readonly [unknown],
      SubqueryFunctionMode,
      true
    >,
  ): ApexSelectQueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    AfterSubqueryMode<Mode, SubqueryFunctionMode>,
    Context
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        unknown,
        readonly [unknown],
        InitialSubqueryFunctionMode<Mode>,
        true
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
        apex: true,
      }),
    );

    const queryNode = SelectQueryNode.cloneWithSelections(
      this.#props.queryNode,
      [SelectionNode.create(subquery.toOperationNode())],
    );
    validateTypeOfSelections(queryNode);

    return new ApexSelectQueryBuilderImpl<
      DB,
      TB,
      O & {
        readonly [Key in Relationship]: SalesforceQueryResult<
          Simplify<SubqueryOutput>
        >;
      },
      AfterSubqueryMode<Mode, SubqueryFunctionMode>,
      Context
    >({
      ...this.#props,
      queryNode,
    });
  }

  where(
    expression: SoqlRawBuilder,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;
  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | SoqlRawBuilder
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
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

    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode,
    });
  }

  setOptions(
    options: DynamicApexOnly<
      Context,
      ApexBindExpression<ApexDatabaseQueryOptions>
    >,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSetOptions(
        this.#props.queryNode,
        parseDynamicApexSetOptions(options),
      ),
    });
  }

  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(
    mode: ApexAccessMode,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode, Context> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, Context>({
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

export function createApexSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
>(
  props: SelectQueryBuilderProps,
): ApexSelectQueryBuilder<DB, TB, O, Mode, "static"> {
  return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, "static">({
    ...props,
    apexContext: "static",
  });
}

export function createDynamicApexSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
>(
  props: SelectQueryBuilderProps,
): ApexSelectQueryBuilder<DB, TB, O, Mode, "dynamic"> {
  return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode, "dynamic">({
    ...props,
    apexContext: "dynamic",
  });
}
