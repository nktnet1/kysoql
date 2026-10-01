import type { ApexBindExpression } from "#src/apex-bind";
import {
  createSelectExpressionBuilder,
  type SelectExpressionBuilder,
} from "#src/expression/aggregate-function-builder";
import {
  type ApexWhereExpressionFactory,
  createApexExpressionBuilder,
} from "#src/expression/apex-expression-builder";
import {
  createExpressionBuilder,
  type WhereExpressionFactory,
} from "#src/expression/expression-builder";
import {
  createGeolocationExpressionBuilder,
  type DistanceFunctionExpression,
  type GeolocationExpressionBuilder,
} from "#src/expression/geolocation-function-builder";
import type { FieldsSelector } from "#src/operation-node/fields-function-node";
import type { ComparisonOperator } from "#src/operation-node/operator-node";
import {
  type OrderByDirection,
  OrderByItemNode,
  type OrderByNulls,
} from "#src/operation-node/order-by-item-node";
import { QueryNode } from "#src/operation-node/query-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import { RelationshipSubqueryNode } from "#src/operation-node/relationship-subquery-node";
import { SelectionNode } from "#src/operation-node/selection-node";
import {
  type ApexOperandValueExpression,
  parseApexFilterBinaryOperation,
} from "#src/parser/apex-bind-parser";
import {
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
  parseValueBinaryOperation,
} from "#src/parser/binary-operation-parser";
import {
  type AvailableSelectExpression,
  type CheckedSelectExpressionList,
  type FieldsSelection,
  type FieldsSelectionCheck,
  parseFieldsSelection,
} from "#src/parser/fields-selection-parser";
import { parseLimit } from "#src/parser/limit-parser";
import { parseOffset } from "#src/parser/offset-parser";
import {
  type OrderByNullsForReference,
  parseDistanceOrderBy,
  parseOrderBy,
  type SortableFieldName,
} from "#src/parser/order-by-parser";
import type {
  ChildObjectName,
  ChildRelationshipName,
  ChildRelationshipReference,
} from "#src/parser/reference-parser";
import {
  parseSelectFunctionSelectArg,
  type SelectFunctionSelection,
  type SelectFunctionSelectionArg,
  validateUniqueSelectionAliases,
} from "#src/parser/select-function-parser";
import {
  parseSelectArg,
  type SelectExpression,
  type Selection,
} from "#src/parser/select-parser";
import type { SalesforceQueryResult } from "#src/schema";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#src/soql";
import { freeze } from "#src/util/object-utils";
import type { KysoqlTypeError } from "#src/util/type-error";
import type {
  ConditionalOutput,
  NarrowPartial,
  Simplify,
} from "#src/util/type-utils";

type ParentToChildDepth = readonly unknown[];

type RelationshipSubqueryFunctionMode = "none" | "present" | "forbidden";

type SelectFunctionForMode<
  Mode extends RelationshipSubqueryFunctionMode,
  Selection,
> = Mode extends "forbidden" ? never : Selection;

type ChildFunctionMode<Mode extends RelationshipSubqueryFunctionMode> =
  Mode extends "forbidden" ? "forbidden" : "none";

type ClearedFunctionMode<Mode extends RelationshipSubqueryFunctionMode> =
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

/**
 * Pilot-only features available while building a relationship subquery.
 */
export interface RelationshipSubqueryPilotModule<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth = readonly [unknown],
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
  ApexMode extends boolean = false,
> {
  /**
   * Opts into Salesforce's relationship-subquery OFFSET pilot, which Salesforce
   * says is not intended for production. The compiler requires the immediate
   * parent query to use a literal LIMIT 1.
   */
  offset(
    offset: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Returns a builder with the `OFFSET` clause removed. */
  clearOffset(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;
}

/** Type-safe builder for a Salesforce child relationship subquery. */
export interface RelationshipSubqueryBuilder<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth = readonly [unknown],
  FunctionMode extends RelationshipSubqueryFunctionMode = "none",
  ApexMode extends boolean = false,
> {
  /** Passes this builder to `func` and returns the callback result. */
  $call<T>(func: (qb: this) => T): T;

  /** Asserts at compile time that the current query output exactly matches `T`. */
  $assertType<T extends O>(): O extends T
    ? RelationshipSubqueryBuilder<DB, TB, T, Depth, FunctionMode, ApexMode>
    : KysoqlTypeError<"$assertType() call failed: The type passed in is not equal to the output type of the query.">;

  /** Changes only the TypeScript output type; the generated SOQL is unchanged. */
  $castTo<C>(): RelationshipSubqueryBuilder<
    DB,
    TB,
    C,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Narrows selected output properties at the type level without changing SOQL. */
  $narrowType<T>(): RelationshipSubqueryBuilder<
    DB,
    TB,
    NarrowPartial<O, T>,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /**
   * Explicitly opt into Salesforce pilot-only relationship-subquery syntax.
   */
  readonly pilot: RelationshipSubqueryPilotModule<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Conditionally applies a builder callback; when false, the runtime query is unchanged. */
  $if<O2>(
    condition: boolean,
    func: (
      qb: this,
    ) => RelationshipSubqueryBuilder<
      DB,
      TB,
      O & O2,
      Depth,
      FunctionMode,
      ApexMode
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    ConditionalOutput<O, O2>,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Returns a builder with the `LIMIT` clause removed. */
  clearLimit(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Returns a builder with all `ORDER BY` items removed. */
  clearOrderBy(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Returns a builder with all current selections removed. */
  clearSelect(): RelationshipSubqueryBuilder<
    DB,
    TB,
    unknown,
    Depth,
    ClearedFunctionMode<FunctionMode>,
    ApexMode
  >;

  /** Returns a builder with the `WHERE` predicate removed. */
  clearWhere(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Adds or replaces the SOQL `LIMIT` clause. */
  limit(
    limit: number,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `ORDER BY` item. */
  orderBy(
    expression: SoqlRawBuilder,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `ORDER BY` item. */
  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `ORDER BY` item. */
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    expression: SoqlRawBuilder,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    expression: RelationshipWhereExpressionFactory<DB, TB, ApexMode>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
  where(
    lhs: RelationshipApexBindLeftExpression<ApexMode>,
    op: "includes",
    rhs: readonly string[],
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;

  /** Adds a typed `WHERE` predicate and combines it with any existing predicate using `AND`. */
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

  /** Adds one or more typed selections to the query output. */
  select<RawOutput>(
    selection: SoqlRawBuilder<RawOutput>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & RawOutput,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Adds one or more typed selections to the query output. */
  select<const Selections extends readonly string[]>(
    selections: Selections & CheckedSelectExpressionList<DB, TB, O, Selections>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, Selections[number]>,
    Depth,
    FunctionMode,
    ApexMode
  >;

  /** Adds one or more typed selections to the query output. */
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

  /** Adds one or more typed selections to the query output. */
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

  /** Select a server-expanded group; unavailable on field-filtered schemas. */
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

  /** Adds a typed child-relationship subquery selection. */
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

  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): RelationshipSubqueryNode;
}

class RelationshipSubqueryBuilderImpl<
  DB,
  TB extends keyof DB,
  O,
  Depth extends ParentToChildDepth,
  FunctionMode extends RelationshipSubqueryFunctionMode,
  ApexMode extends boolean,
> implements
    RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>
{
  readonly #props: RelationshipSubqueryBuilderProps<ApexMode>;
  readonly #pilot: RelationshipSubqueryPilotModule<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  >;

  constructor(props: RelationshipSubqueryBuilderProps<ApexMode>) {
    this.#props = freeze(props);
    this.#pilot = freeze({
      offset: (offset: number) => this.#withPilotOffset(offset),
      clearOffset: () => this.#withoutPilotOffset(),
    });
  }

  get pilot(): RelationshipSubqueryPilotModule<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return this.#pilot;
  }

  $call<T>(func: (qb: this) => T): T {
    return func(this);
  }

  $assertType<T extends O>(): O extends T
    ? RelationshipSubqueryBuilder<DB, TB, T, Depth, FunctionMode, ApexMode>
    : KysoqlTypeError<"$assertType() call failed: The type passed in is not equal to the output type of the query."> {
    return new RelationshipSubqueryBuilderImpl({ ...this.#props }) as never;
  }

  $castTo<C>(): RelationshipSubqueryBuilder<
    DB,
    TB,
    C,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      C,
      Depth,
      FunctionMode,
      ApexMode
    >({ ...this.#props });
  }

  $narrowType<T>(): RelationshipSubqueryBuilder<
    DB,
    TB,
    NarrowPartial<O, T>,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      NarrowPartial<O, T>,
      Depth,
      FunctionMode,
      ApexMode
    >({ ...this.#props });
  }

  $if<O2>(
    condition: boolean,
    func: (
      qb: this,
    ) => RelationshipSubqueryBuilder<
      DB,
      TB,
      O & O2,
      Depth,
      FunctionMode,
      ApexMode
    >,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    ConditionalOutput<O, O2>,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return (condition ? func(this) : this) as RelationshipSubqueryBuilder<
      DB,
      TB,
      ConditionalOutput<O, O2>,
      Depth,
      FunctionMode,
      ApexMode
    >;
  }

  clearLimit(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithoutLimit(
        this.#props.queryNode,
      ),
    });
  }

  clearOrderBy(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithoutOrderBy(
        this.#props.queryNode,
      ),
    });
  }

  clearSelect(): RelationshipSubqueryBuilder<
    DB,
    TB,
    unknown,
    Depth,
    ClearedFunctionMode<FunctionMode>,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      unknown,
      Depth,
      ClearedFunctionMode<FunctionMode>,
      ApexMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithoutSelections(
        this.#props.queryNode,
      ),
    });
  }

  clearWhere(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
      ...this.#props,
      queryNode: QueryNode.cloneWithoutWhere(this.#props.queryNode),
    });
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
    expression: SoqlRawBuilder,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;
  orderBy(
    expression: DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;
  orderBy<OE extends string>(
    field: OE & SortableFieldName<DB, TB, OE>,
    direction?: OrderByDirection,
    nulls?: OrderByNullsForReference<DB, TB, OE>,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode>;
  orderBy(
    fieldOrExpression: string | SoqlRawBuilder | DistanceOrderByFactory<DB, TB>,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
    const item = isSoqlRawBuilder(fieldOrExpression)
      ? OrderByItemNode.create(
          fieldOrExpression.toOperationNode(),
          direction,
          nulls,
        )
      : typeof fieldOrExpression === "function"
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
      | SoqlRawBuilder
      | RelationshipWhereExpressionFactory<DB, TB, ApexMode>,
    op?: ComparisonOperator,
    rhs?: unknown,
  ): RelationshipSubqueryBuilder<DB, TB, O, Depth, FunctionMode, ApexMode> {
    const operation = isSoqlRawBuilder(lhsOrExpression)
      ? lhsOrExpression.toOperationNode()
      : typeof lhsOrExpression === "function"
        ? this.#props.apex
          ? (lhsOrExpression as ApexWhereExpressionFactory<DB, TB, false>)(
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

  select<RawOutput>(
    selection: SoqlRawBuilder<RawOutput>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & RawOutput,
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
  select<const Selections extends readonly string[]>(
    selections: Selections & CheckedSelectExpressionList<DB, TB, O, Selections>,
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    O & Selection<DB, TB, Selections[number]>,
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
      | SoqlRawBuilder<unknown>
      | ((eb: SelectExpressionBuilder<DB, TB>) => SelectFunctionSelectionArg),
  ): RelationshipSubqueryBuilder<
    DB,
    TB,
    unknown,
    Depth,
    FunctionMode | "present",
    ApexMode
  > {
    const selections = isSoqlRawBuilder(selection)
      ? [SelectionNode.create(selection.toOperationNode())]
      : typeof selection === "function"
        ? parseSelectFunctionSelectArg(
            selection(createSelectExpressionBuilder<DB, TB>()),
          )
        : parseSelectArg(selection);

    validateUniqueSelectionAliases(
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

  #withPilotOffset(
    offset: number,
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
      queryNode: RelationshipSubqueryNode.cloneWithOffset(
        this.#props.queryNode,
        parseOffset(offset),
      ),
    });
  }

  #withoutPilotOffset(): RelationshipSubqueryBuilder<
    DB,
    TB,
    O,
    Depth,
    FunctionMode,
    ApexMode
  > {
    return new RelationshipSubqueryBuilderImpl<
      DB,
      TB,
      O,
      Depth,
      FunctionMode,
      ApexMode
    >({
      ...this.#props,
      queryNode: RelationshipSubqueryNode.cloneWithoutOffset(
        this.#props.queryNode,
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
