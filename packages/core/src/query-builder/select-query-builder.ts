import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectionNode } from "#/operation-node/selection-node";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import type { QueryExecutor } from "#/query-executor";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { parseLimit } from "#/parser/limit-parser";
import { parseOffset } from "#/parser/offset-parser";
import {
  parseValueBinaryOperation,
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import {
  parseSelectArg,
  type SelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import {
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { freeze } from "#/util/object-utils";
import {
  createRelationshipSubqueryBuilder,
  type RelationshipSubqueryBuilder,
} from "#/query-builder/relationship-subquery-builder";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import type { SalesforceQueryResult } from "#/schema";
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
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  ): SelectQueryBuilder<DB, TB, O>;

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
    lhsOrExpression: string | WhereExpressionFactory<DB, TB>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): SelectQueryBuilder<DB, TB, O> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(createExpressionBuilder<DB, TB>()).toOperationNode()
        : parseValueBinaryOperation(lhsOrExpression, op as ComparisonOperator, rhs);

    return new SelectQueryBuilderImpl<DB, TB, O>({
      ...this.#props,
      queryNode: QueryNode.cloneWithWhere(this.#props.queryNode, operation),
    });
  }

  select<SE extends string>(
    selection: SelectArg<DB, TB, SE>,
  ): SelectQueryBuilder<DB, TB, O & Selection<DB, TB, SE>> {
    return new SelectQueryBuilderImpl<DB, TB, O & Selection<DB, TB, SE>>({
      ...this.#props,
      queryNode: SelectQueryNode.cloneWithSelections(
        this.#props.queryNode,
        parseSelectArg(selection),
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
