import type { ApexBindExpression } from "#/apex-bind";
import {
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#/expression/aggregate-function-builder";
import {
  type ApexWhereExpressionFactory,
  createApexExpressionBuilder,
} from "#/expression/apex-expression-builder";
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
  type ApexOperandValueExpression,
  parseApexFilterBinaryOperation,
} from "#/parser/apex-bind-parser";
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

type RelationshipWhereExpressionFactory<
  DB,
  TB extends keyof DB,
  ApexMode extends boolean,
> = ApexMode extends true
  ? ApexWhereExpressionFactory<DB, TB, false>
  : WhereExpressionFactory<DB, TB, false>;

type RelationshipOperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
  ApexMode extends boolean,
> = ApexMode extends true
  ? ApexOperandValueExpression<DB, TB, RE, OP, false>
  : OperandValueExpression<DB, TB, RE, OP, false>;

type RelationshipApexBindLeftExpression<ApexMode extends boolean> =
  ApexMode extends true ? ApexBindExpression<string> : never;

export interface RelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth = readonly [unknown],
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
  ApexMode extends boolean = false,
> {
  limit(
    limit: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  where(
    expression: RelationshipWhereExpressionFactory<DB, TB, ApexMode>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  where(
    lhs: RelationshipApexBindLeftExpression<ApexMode>,
    op: "includes",
    rhs: readonly string[],
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  where<
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends RelationshipOperandValueExpression<
      DB,
      TB,
      RE,
      NoInfer<OP>,
      ApexMode
    >,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

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
    FunctionMode,
    ApexMode
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
    "present",
    ApexMode
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
    FunctionMode,
    ApexMode
  >;

  selectFields<Selector extends FieldsSelector>(
    selector: Selector,
    ...check: FieldsSelectionCheck<DB, TB, O, Selector>
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & FieldsSelection<DB, TB, Selector>,
    Depth,
    FunctionMode,
    ApexMode
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
        unknown,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>,
        ApexMode
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>,
      SubqueryFunctionMode,
      ApexMode
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
    MergeFunctionMode<FunctionMode, SubqueryFunctionMode>,
    ApexMode
  >;

  toOperationNode(): RelationshipSubqueryNode;
}

class RelationshipSubqueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
  FunctionMode extends RelationshipSubqueryFunctionMode,
  ApexMode extends boolean,
> implements RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>
{
  readonly #props: RelationshipSubqueryBuilderProps<ApexMode>;

  constructor(props: RelationshipSubqueryBuilderProps<ApexMode>) {
    this.#props = freeze(props);
  }

  limit(
    limit: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
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
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;
  orderBy(
    fieldOrExpression: string | DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
    const item =
      typeof fieldOrExpression === "function"
        ? parseDistanceOrderBy(
            fieldOrExpression(createGeolocationExpressionBuilder<DB, TB>()),
            direction,
            nulls,
          )
        : parseOrderBy(fieldOrExpression, direction, nulls);

    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithOrderByItems(
        this.#props.queryNode,
        [item],
      ),
    });
  }

  where(
    lhsOrExpression:
      | string
      | ApexBindExpression<string>
      | RelationshipWhereExpressionFactory<DB, TB, ApexMode>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
    const operation =
      typeof lhsOrExpression === "function"
        ? this.#props.apex
          ? (
              lhsOrExpression as ApexWhereExpressionFactory<DB, TB, false>
            )(
              createApexExpressionBuilder<DB, TB, false>({
                allowSemiJoin: false,
              }),
            ).toOperationNode()
          : (lhsOrExpression as WhereExpressionFactory<DB, TB, false>)(
              createExpressionBuilder<DB, TB, false>({ allowSemiJoin: false }),
            ).toOperationNode()
        : this.#props.apex
          ? parseApexFilterBinaryOperation(
              lhsOrExpression,
              op as ComparisonOperator,
              rhs,
              { allowSemiJoin: false },
            )
          : parseValueBinaryOperation(
              lhsOrExpression as string,
              op as ComparisonOperator,
              rhs,
            );

    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
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
    "present",
    ApexMode
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
    FunctionMode,
    ApexMode
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
    FunctionMode,
    ApexMode
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
    FunctionMode | "present",
    ApexMode
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
      FunctionMode | "present",
      ApexMode
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
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O & FieldsSelection<DB, TB, Selector>,
      Depth,
      FunctionMode,
      ApexMode
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
        unknown,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>,
        ApexMode
      >,
    ) => RelationshipSubqueryBuilder<
      DB,
      ChildObjectForRelationship<DB, TB, Relationship>,
      SubqueryOutput,
      NextParentToChildDepth<Depth>,
      SubqueryFunctionMode,
      ApexMode
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
    MergeFunctionMode<FunctionMode, SubqueryFunctionMode>,
    ApexMode
  > {
    const subquery = callback(
      createRelationshipSubqueryBuilder<
        DB,
        ChildObjectForRelationship<DB, TB, Relationship>,
        unknown,
        NextParentToChildDepth<Depth>,
        ChildFunctionMode<FunctionMode>,
        ApexMode
      >({
        queryNode: RelationshipSubqueryNode.create(
          ReferenceNode.create(relationship),
        ),
        apex: this.#props.apex,
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
      MergeFunctionMode<FunctionMode, SubqueryFunctionMode>,
      ApexMode
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

export interface RelationshipSubqueryBuilderProps<
  ApexMode extends boolean = false,
> {
  readonly queryNode: RelationshipSubqueryNode;
  readonly apex: ApexMode;
}

export function createRelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
  ApexMode extends boolean = false,
>(
  props: RelationshipSubqueryBuilderProps<ApexMode>,
): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
  return new RelationshipSubqueryBuilderImpl<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >(props);
}
