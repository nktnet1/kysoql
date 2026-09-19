import {
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#/expression/expression-builder";
import {
  createGeolocationExpressionBuilder,
  type DistanceFunctionExpression,
  type GeolocationExpressionBuilder,
} from "#/expression/geolocation-function-builder";
import type { FieldsSelector } from "#/operation-node/fields-function-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type {
  OrderByDirection,
  OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { SelectionNode } from "#/operation-node/selection-node";
import {
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
  parseValueBinaryOperation,
} from "#/parser/binary-operation-parser";
import {
  type AvailableSelectExpression,
  type FieldsSelection,
  type FieldsSelectionCheck,
  parseFieldsSelection,
} from "#/parser/fields-selection-parser";
import { parseLimit } from "#/parser/limit-parser";
import {
  parseDistanceOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#/parser/order-by-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#/parser/reference-parser";
import {
  parseSelectFunctionSelectArg,
  type SelectFunctionSelection,
  type SelectFunctionSelectionArg,
  validateUniqueSelectFunctionAliases,
} from "#/parser/select-function-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#/parser/select-parser";
import type { SalesforceQueryResult } from "#/schema";
import { freeze } from "#/util/object-utils";
import type { Simplify } from "#/util/type-utils";

type ParentToChildDepth = readonly unknown[];

type RelationshipSubqueryFunctionMode = "none" | "present" | "forbidden";

type SelectFunctionForMode<
  Mode extends RelationshipSubqueryFunctionMode,
  Selection,
> = Mode extends "forbidden" ? never : Selection;

type ChildFunctionMode<Mode extends RelationshipSubqueryFunctionMode> =
  Mode extends "forbidden" ? "forbidden" : "none";

type MergeFunctionMode<
  Mode extends RelationshipSubqueryFunctionMode,
  ChildMode extends RelationshipSubqueryFunctionMode,
> = Mode extends "forbidden"
  ? "forbidden"
  : Mode extends "present"
    ? "present"
    : ChildMode extends "present"
      ? "present"
      : "none";

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

type DistanceOrderByFactory<DB, TB extends keyof DB> = (
  eb: GeolocationExpressionBuilder<DB, TB>,
) => DistanceFunctionExpression<unknown, boolean, true>;

export interface RelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth = readonly [unknown],
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
> {
  limit(
    limit: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;

  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;

  where(
    expression: WhereExpressionFactory<DB, TB, false>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, false>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;

  select<SE extends string>(
    selections: ReadonlyArray<
      SE &
        SelectExpression<DB, TB, SE> &
        AvailableSelectExpression<DB, TB, O, SE>
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    Depth,
    FunctionMode
  >;

  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionForMode<
      FunctionMode,
      (eb: SelectExpressionBuilder<DB, TB>) => FunctionSelection
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    Depth,
    "present"
  >;

  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    Depth,
    FunctionMode
  >;

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ...check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & FieldsSelection<DB, TB, Selector>,
    Depth,
    FunctionMode
  >;

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends RelationshipSubqueryFunctionMode,
  >(
    relationship: Relationship &
      SelectableChildRelationship<DB, TB, Relationship, Depth>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>,
      SubqueryFunctionMode
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    Depth,
    MergeFunctionMode<FunctionMode, SubqueryFunctionMode>
  >;

  toOperationNode(): RelationshipSubqueryNode;
}

class RelationshipSubqueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
  FunctionMode extends RelationshipSubqueryFunctionMode,
> implements RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>
{
  readonly #props: RelationshipSubqueryBuilderProps;

  constructor(props: RelationshipSubqueryBuilderProps) {
    this.#props = freeze(props);
  }

  limit(
    limit: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode> {
    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth, FunctionMode>({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithLimit(
        this.#props.queryNode,
        parseLimit(limit),
      ),
    });
  }

  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode>;
  orderBy(
    fieldOrExpression: string | DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode> {
    const item =
      typeof fieldOrExpression === "function"
        ? parseDistanceOrderBy(
            fieldOrExpression(createGeolocationExpressionBuilder<DB, TB>()),
            direction,
            nulls,
          )
        : parseOrderBy(fieldOrExpression, direction, nulls);

    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth, FunctionMode>({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithOrderByItems(
        this.#props.queryNode,
        [item],
      ),
    });
  }

  where(
    lhsOrExpression: string | WhereExpressionFactory<DB, TB, false>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode> {
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

    return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth, FunctionMode>({
      ...this.#props,
      queryNode: QueryNode.cloneWithWhere(this.#props.queryNode, operation),
    });
  }

  select<FunctionSelection extends SelectFunctionSelectionArg>(
    selection: SelectFunctionForMode<
      FunctionMode,
      (eb: SelectExpressionBuilder<DB, TB>) => FunctionSelection
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & SelectFunctionSelection<FunctionSelection>,
    Depth,
    "present"
  >;
  select<SE extends string>(
    selections: ReadonlyArray<
      SE &
        SelectExpression<DB, TB, SE> &
        AvailableSelectExpression<DB, TB, O, SE>
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    Depth,
    FunctionMode
  >;
  select<SE extends string>(
    selection: SE &
      SelectExpression<DB, TB, SE> &
      AvailableSelectExpression<DB, TB, O, SE>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, SE>,
    Depth,
    FunctionMode
  >;
  select(
    selection:
      | string
      | readonly string[]
      | ((eb: SelectExpressionBuilder<DB, TB>) => SelectFunctionSelectionArg),
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    unknown,
    Depth,
    FunctionMode | "present"
  > {
    const selections =
      typeof selection === "function"
        ? parseSelectFunctionSelectArg(
            selection(createSelectExpressionBuilder<DB, TB>()),
          )
        : parseSelectArg(selection);

    validateUniqueSelectFunctionAliases(
      this.#props.queryNode.selections ?? [],
      selections,
    );

    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      unknown,
      Depth,
      FunctionMode | "present"
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithSelections(
        this.#props.queryNode,
        selections,
      ),
    });
  }

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ..._check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & FieldsSelection<DB, TB, Selector>,
    Depth,
    FunctionMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O & FieldsSelection<DB, TB, Selector>,
      Depth,
      FunctionMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithSelections(
        this.#props.queryNode,
        [parseFieldsSelection(selector)],
      ),
    });
  }

  selectSubquery<
    Relationship extends string,
    SubqueryOutput,
    SubqueryFunctionMode extends RelationshipSubqueryFunctionMode,
  >(
    relationship: Relationship &
      SelectableChildRelationship<DB, TB, Relationship, Depth>,
    callback: (
      query: RelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>,
      SubqueryFunctionMode
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & {
      readonly [Key in Relationship]: SalesforceQueryResult<
        Simplify<SubqueryOutput>
      >;
    },
    Depth,
    MergeFunctionMode<FunctionMode, SubqueryFunctionMode>
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        Record<never, never>,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>
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
      Depth,
      MergeFunctionMode<FunctionMode, SubqueryFunctionMode>
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
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
>(
  props: RelationshipSubqueryBuilderProps,
): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode> {
  return new RelationshipSubqueryBuilderImpl<DB, TB, O, Depth, FunctionMode>(
    props,
  );
}
