import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectionNode } from "#/operation-node/selection-node";
import {
  parseValueBinaryOperation,
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
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
import type { SalesforceQueryResult } from "#/schema";
import { freeze } from "#/util/object-utils";
import type { Simplify } from "#/util/type-utils";

type ParentToChildDepth = readonly unknown[];

type NextParentToChildDepth<Depth extends ParentToChildDepth> = readonly [
  ...Depth,
  unknown,
];

type ChildObjectForRelationship<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> = ChildObjectName<
  DB,
  TB,
  Extract<Relationship, ChildRelationshipName<DB, TB>>
>;

type SelectableChildRelationship<
  DB,
  TB extends keyof DB,
  Relationship extends string,
  Depth extends ParentToChildDepth,
> = Depth["length"] extends 4
  ? never
  : ChildRelationshipReference<DB, TB, Relationship>;

export interface RelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth = readonly [unknown],
> {
  limit(limit: number): RelationshipSubqueryBuilder<DB, TB, O, Depth>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth>;

  where(
    expression: WhereExpressionFactory<DB, TB, false>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth>;

  select<SE extends string>(
    selections: ReadonlyArray<SE & SelectExpression<DB, TB, SE>>,
  ): RelationshipSubqueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Depth>;

  select<SE extends string>(
    selection: SE & SelectExpression<DB, TB, SE>,
  ): RelationshipSubqueryBuilder<DB, TB, O & Selection<DB, TB, SE>, Depth>;

  selectSubquery<Relationship extends string, SubqueryOutput>(
    relationship: Relationship &
      SelectableChildRelationship<DB, TB, Relationship, Depth>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    Depth
  >;

  toOperationNode(): RelationshipSubqueryNode;
}

class RelationshipSubqueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
> implements RelationshipSubqueryBuilder<DB, TB, O, Depth>
{
  readonly #props: RelationshipSubqueryBuilderProps;

  constructor(props: RelationshipSubqueryBuilderProps) {
    this.#props = freeze(props);
  }

  limit(limit: number): RelationshipSubqueryBuilder<DB, TB, O, Depth> {
    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth>({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth> {
    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth>({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithOrderByItems(
        this.#props.queryNode,
        [parseOrderBy(field, direction, nulls)],
      ),
    });
  }

  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB, false>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth> {
    const operation =
      typeof lhsOrExpression === "function"
        ? lhsOrExpression(
            createExpressionBuilder<DB, TB, false>({ allowSemiJoin: false }),
          ).toOperationNode()
        : parseValueBinaryOperation(
            lhsOrExpression,
            op as ComparisonOperator,
            rhs,
          );

    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth>({
      ...this.#props,
      queryNode: QueryNode.cloneWithWhere(this.#props.queryNode, operation),
    });
  }

  select<SE extends string>(
    selection: SelectArg<DB, TB, SE>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    Depth
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O & Selection<DB, TB, SE>,
      Depth
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithSelections(
        this.#props.queryNode,
        parseSelectArg(selection),
      ),
    });
  }

  selectSubquery<Relationship extends string, SubqueryOutput>(
    relationship: Relationship &
      SelectableChildRelationship<DB, TB, Relationship, Depth>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    Depth
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
      }),
    );

    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O & {
        readonly [Key in Relationship]: SalesforceQueryResult<
          Simplify<SubqueryOutput>
        >;
      },
      Depth
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithSelections(
        this.#props.queryNode,
        [SelectionNode.create(subquery.toOperationNode())],
      ),
    });
  }

  toOperationNode(): RelationshipSubqueryNode {
    return this.#props.queryNode;
  }
}

export interface RelationshipSubqueryBuilderProps {
  readonly queryNode: RelationshipSubqueryNode;
}

export function createRelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
>(
  props: RelationshipSubqueryBuilderProps,
): RelationshipSubqueryBuilder<DB, TB, O, Depth> {
  return new RelationshipSubqueryBuilderImpl(props);
}
