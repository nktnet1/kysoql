import type { ApexBindExpression } from "#/apex-bind";
import {
  type ApexWhereExpressionFactory,
  createApexExpressionBuilder,
} from "#/expression/apex-expression-builder";
import {
  type ApexAccessMode,
  ApexAccessModeNode,
} from "#/operation-node/apex-access-mode-node";
import { ForUpdateNode } from "#/operation-node/for-update-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
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
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import { validateTypeOfSelections } from "#/parser/type-of-parser";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#/query-builder/relationship-subquery-builder";
import type {
  SelectQueryBuilderProps,
  SelectQueryMode,
} from "#/query-builder/select-query-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
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

export interface ApexSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode = SelectQueryMode,
> {
  compile(): CompiledQuery<O>;

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;

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
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
  >;

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  withUserMode(): ApexSelectQueryBuilder<DB, TB, O, Mode>;

  toOperationNode(): SelectQueryNode;
}

class ApexSelectQueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
> implements ApexSelectQueryBuilder<DB, TB, O, Mode>
{
  readonly #props: SelectQueryBuilderProps;

  constructor(props: SelectQueryBuilderProps) {
    this.#props = freeze(props);
  }

  compile(): CompiledQuery<O> {
    return this.#props.queryCompiler.compileQuery<O>(this.#props.queryNode);
  }

  forUpdate(): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithForUpdate(
        this.#props.queryNode,
        ForUpdateNode.create(),
      ),
    });
  }

  limit(
    limit: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseApexLimit(limit),
      ),
    });
  }

  offset(
    offset: number | ApexBindExpression<number>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>({
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
    AfterSubqueryMode<Mode, SubqueryFunctionMode>
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
      AfterSubqueryMode<Mode, SubqueryFunctionMode>
    >({
      ...this.#props,
      queryNode,
    });
  }

  where(
    expression: ApexWhereExpressionFactory<DB, TB>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;
  where(
    lhs: ApexBindExpression<string>,
    op: "includes",
    rhs: readonly string[],
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;
  where<RE extends string, OP extends ComparisonOperatorExpression<DB, TB, RE>>(
    lhs: RE extends FilterableFieldName<DB, TB, RE> ? RE : never,
    op: OP,
    rhs: ApexOperandValueExpression<DB, TB, NoInfer<RE>, NoInfer<OP>>,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode>;
  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | ApexWhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode> {
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

    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>({
      ...this.#props,
      queryNode,
    });
  }

  withSystemMode(): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return this.#withAccessMode("system");
  }

  withUserMode(): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return this.#withAccessMode("user");
  }

  #withAccessMode(
    mode: ApexAccessMode,
  ): ApexSelectQueryBuilder<DB, TB, O, Mode> {
    return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>({
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

export function createApexSelectQueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Mode extends SelectQueryMode,
>(
  props: SelectQueryBuilderProps,
): ApexSelectQueryBuilder<DB, TB, O, Mode> {
  return new ApexSelectQueryBuilderImpl<DB, TB, O, Mode>(props);
}
