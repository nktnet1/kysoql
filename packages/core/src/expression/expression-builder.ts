import {
  type ConvertTimezoneFunctionBuilder,
  createSelectExpressionBuilder,
  type DateFunctionExpression,
  type TranslatableFieldReference,
} from "#/expression/aggregate-function-builder";
import {
  type BetaExpressionModule,
  createBetaExpressionModule,
  type FormulaFilterComparisonOperator,
  type FormulaFilterFunctionExpression,
} from "#/expression/formula-filter-function-builder";
import type {
  DistanceFunctionExpression,
  GeolocationFilterFunctionModule,
} from "#/expression/geolocation-function-builder";
import { AndNode } from "#/operation-node/and-node";
import { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type {
  ComparisonOperator,
  EqualityComparisonOperator,
  LikeComparisonOperator,
  OrderedComparisonOperator,
  SetComparisonOperator,
} from "#/operation-node/operator-node";
import { OrNode } from "#/operation-node/or-node";
import type { ToLabelFunctionNode } from "#/operation-node/to-label-function-node";
import {
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
  parseOperationValueBinaryOperation,
} from "#/parser/binary-operation-parser";
import { parseFilterBinaryOperation } from "#/parser/filter-parser";
import {
  type DistanceComparisonOperator,
  parseDistanceFilterBinaryOperation,
} from "#/parser/geolocation-expression-parser";
import type {
  FieldReferenceDefinition,
  FieldReferenceNullable,
} from "#/parser/reference-parser";
import type { SoqlLikeLiteral } from "#/soql-like-literal";
import type { SoqlDateLiteral } from "#/soql-temporal-literal";

declare const expressionType: unique symbol;
declare const toLabelFilterExpressionType: unique symbol;

type SemiJoinFlag<Value> = Value extends (...args: never[]) => unknown
  ? true
  : false;

type ExpressionSemiJoinFlag<Expression> = Expression extends {
  readonly [expressionType]: {
    readonly containsSemiJoin: infer ContainsSemiJoin extends boolean;
  };
}
  ? ContainsSemiJoin
  : never;

type CombinedSemiJoinFlag<Expressions extends readonly unknown[]> =
  true extends ExpressionSemiJoinFlag<Expressions[number]> ? true : false;

type TemporalSalesforceType = "date" | "datetime";

type DateFunctionComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | SetComparisonOperator;

type DateFilterFunctionInput = ConvertTimezoneFunctionBuilder<string> | string;

type FilterableDateFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
  SalesforceType extends TemporalSalesforceType = TemporalSalesforceType,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly filterable: true;
          readonly salesforceType: SalesforceType;
        }
      ? Reference
      : never
  : never;

type DateFilterFunctionArgument<
  DB,
  TB extends keyof DB,
  Input extends DateFilterFunctionInput,
  SalesforceType extends TemporalSalesforceType = TemporalSalesforceType,
> = Input extends string
  ? Input & FilterableDateFieldReference<DB, TB, Input, SalesforceType>
  : Input;

type NumericDateFilterFunctionExpression = DateFunctionExpression<
  number | null,
  number | null,
  DateFunctionComparisonOperator,
  string
>;

type DayOnlyDateFilterFunctionExpression = DateFunctionExpression<
  string | null,
  SoqlDateLiteral | null,
  DateFunctionComparisonOperator,
  string
>;

type DateFunctionOperandValue<
  Value,
  Operator extends ComparisonOperator,
> = Operator extends OrderedComparisonOperator
  ? NonNullable<Value>
  : Operator extends SetComparisonOperator
    ? readonly Value[]
    : Value;

/**
 * Comparison operators supported when filtering a toLabel() expression.
 */
export type ToLabelFilterComparisonOperator =
  | EqualityComparisonOperator
  | LikeComparisonOperator;

type TerminalFieldName<Reference extends string> =
  Reference extends `${string}.${infer Tail}`
    ? TerminalFieldName<Tail>
    : Reference;

type UnsupportedToLabelWhereFieldName = "CurrencyIsoCode" | "Division";

/**
 * Restricts a field reference to filterable values supported by toLabel().
 */
export type FilterableToLabelFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> =
  Reference extends TranslatableFieldReference<DB, TB, Reference>
    ? Reference extends FilterableFieldName<DB, TB, Reference>
      ? TerminalFieldName<Reference> extends UnsupportedToLabelWhereFieldName
        ? never
        : Reference
      : never
    : never;

type ToLabelFilterOperatorForReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> =
  Reference extends FilterableToLabelFieldReference<DB, TB, Reference>
    ? FieldReferenceDefinition<DB, TB, Reference> extends {
        readonly salesforceType: "picklist";
      }
      ? ToLabelFilterComparisonOperator
      : EqualityComparisonOperator
    : never;

type ToLabelFilterValue<DB, TB extends keyof DB, Reference extends string> =
  true extends FieldReferenceNullable<DB, TB, Reference>
    ? string | null
    : string;

type ToLabelFilterOperandValue<
  Value,
  Operator extends ToLabelFilterComparisonOperator,
> = Operator extends LikeComparisonOperator ? string | SoqlLikeLiteral : Value;

/** Typed toLabel() expression used in WHERE comparisons. */
export interface ToLabelFilterFunctionExpression<Reference extends string> {
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [toLabelFilterExpressionType]: {
    /** Field reference wrapped by this `toLabel()` expression. */
    readonly reference: Reference;
  };

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): ToLabelFunctionNode;
}

interface DateFilterFunctionModule<DB, TB extends keyof DB> {
  calendarMonth<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  calendarQuarter<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  calendarYear<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  dayInMonth<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  dayInWeek<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  dayInYear<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  dayOnly<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input, "datetime">,
  ): DayOnlyDateFilterFunctionExpression;

  fiscalMonth<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  fiscalQuarter<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  fiscalYear<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  hourInDay<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input, "datetime">,
  ): NumericDateFilterFunctionExpression;

  weekInMonth<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  weekInYear<Input extends DateFilterFunctionInput>(
    field: Input & DateFilterFunctionArgument<DB, TB, Input>,
  ): NumericDateFilterFunctionExpression;

  convertTimezone<Reference extends string>(
    field: Reference &
      FilterableDateFieldReference<DB, TB, Reference, "datetime">,
  ): ConvertTimezoneFunctionBuilder<Reference>;
}

interface ToLabelFilterFunctionModule<DB, TB extends keyof DB> {
  toLabel<Reference extends string>(
    field: Reference & FilterableToLabelFieldReference<DB, TB, Reference>,
  ): ToLabelFilterFunctionExpression<Reference>;
}

type FilterFunctionModule<DB, TB extends keyof DB> = DateFilterFunctionModule<
  DB,
  TB
> &
  GeolocationFilterFunctionModule<DB, TB> &
  ToLabelFilterFunctionModule<DB, TB>;

/** Typed wrapper around a filter operation node. */
export interface ExpressionWrapper<
  DB,
  TB extends keyof DB,
  ContainsSemiJoin extends boolean = false,
> {
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [expressionType]: {
    /** Schema type carried through expression inference. */
    readonly db: DB;
    /** Salesforce object type carried through expression inference. */
    readonly table: TB;
    /** Whether this expression already contains a semi-join. */
    readonly containsSemiJoin: ContainsSemiJoin;
  };

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): OperationNode;
}

/** Expression helper passed to typed WHERE callbacks. */
export interface ExpressionBuilder<
  DB,
  TB extends keyof DB,
  AllowSemiJoin extends boolean = true,
> {
  /** Builds a typed `WHERE` comparison from the supplied left operand, operator, and right operand. */
  <Output, Sortable extends boolean>(
    lhs: DistanceFunctionExpression<Output, true, Sortable>,
    op: DistanceComparisonOperator,
    rhs: number,
  ): ExpressionWrapper<DB, TB, false>;

  /** Builds a typed `WHERE` comparison from the supplied left operand, operator, and right operand. */
  <
    Output,
    Value,
    AllowedOperator extends ComparisonOperator,
    Operator extends AllowedOperator,
    Identity extends string,
    Right extends DateFunctionOperandValue<Value, NoInfer<Operator>>,
  >(
    lhs: DateFunctionExpression<Output, Value, AllowedOperator, Identity>,
    op: Operator,
    rhs: Right,
  ): ExpressionWrapper<DB, TB, false>;

  /** Builds a typed `WHERE` comparison from the supplied left operand, operator, and right operand. */
  <
    Reference extends string,
    Operator extends ToLabelFilterOperatorForReference<DB, TB, Reference>,
    Right extends ToLabelFilterOperandValue<
      ToLabelFilterValue<DB, TB, Reference>,
      NoInfer<Operator>
    >,
  >(
    lhs: ToLabelFilterFunctionExpression<Reference>,
    op: Operator,
    rhs: Right,
  ): ExpressionWrapper<DB, TB, false>;

  /** Builds a typed `WHERE` comparison from the supplied left operand, operator, and right operand. */
  <Value, Operator extends FormulaFilterComparisonOperator>(
    lhs: FormulaFilterFunctionExpression<Value>,
    op: Operator,
    rhs: Value,
  ): ExpressionWrapper<DB, TB, false>;

  /** Builds a typed `WHERE` comparison from the supplied left operand, operator, and right operand. */
  <
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, AllowSemiJoin>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): ExpressionWrapper<DB, TB, SemiJoinFlag<RHS>>;

  /** Combines two or more expressions with boolean `AND`. */
  and<
    Expressions extends readonly [
      ExpressionWrapper<DB, TB, boolean>,
      ExpressionWrapper<DB, TB, boolean>,
      ...ExpressionWrapper<DB, TB, boolean>[],
    ],
  >(
    expressions: Expressions,
  ): ExpressionWrapper<DB, TB, CombinedSemiJoinFlag<Expressions>>;

  /** Negates an expression with boolean `NOT`. */
  not(
    expression: ExpressionWrapper<DB, TB, false>,
  ): ExpressionWrapper<DB, TB, false>;

  /** Combines two or more expressions with boolean `OR`. */
  or(
    expressions: readonly [
      ExpressionWrapper<DB, TB, false>,
      ExpressionWrapper<DB, TB, false>,
      ...ExpressionWrapper<DB, TB, false>[],
    ],
  ): ExpressionWrapper<DB, TB, false>;

  /** Opt-in helpers for beta SOQL expression features. */
  readonly beta: BetaExpressionModule<DB, TB>;
  /** Function helpers available in this expression context. */
  readonly fn: FilterFunctionModule<DB, TB>;
}

/**
 * Callback that builds a typed WHERE expression from an ExpressionBuilder.
 */
export type WhereExpressionFactory<
  DB,
  TB extends keyof DB,
  AllowSemiJoin extends boolean = true,
> = (
  eb: ExpressionBuilder<DB, TB, AllowSemiJoin>,
) => ExpressionWrapper<DB, TB, AllowSemiJoin extends true ? boolean : false>;

class ExpressionWrapperImpl<
  DB,
  TB extends keyof DB,
  ContainsSemiJoin extends boolean,
> implements ExpressionWrapper<DB, TB, ContainsSemiJoin>
{
  declare readonly [expressionType]: {
    readonly db: DB;
    readonly table: TB;
    readonly containsSemiJoin: ContainsSemiJoin;
  };

  readonly #node: OperationNode;

  constructor(node: OperationNode) {
    this.#node = node;
  }

  toOperationNode(): OperationNode {
    return this.#node;
  }
}

export interface ExpressionBuilderOptions<AllowSemiJoin extends boolean> {
  readonly allowSemiJoin?: AllowSemiJoin;
  readonly outerObject?: string;
}

export function createExpressionBuilder<
  DB,
  TB extends keyof DB,
  AllowSemiJoin extends boolean = true,
>(
  options: ExpressionBuilderOptions<AllowSemiJoin> = {},
): ExpressionBuilder<DB, TB, AllowSemiJoin> {
  const expression = (
    lhs:
      | string
      | DateFunctionExpression<unknown, unknown, ComparisonOperator, string>
      | DistanceFunctionExpression<unknown, boolean, boolean>
      | FormulaFilterFunctionExpression<unknown>
      | ToLabelFilterFunctionExpression<string>,
    op: ComparisonOperator,
    rhs: unknown,
  ): ExpressionWrapper<DB, TB, boolean> => {
    let node: OperationNode;

    if (typeof lhs === "string") {
      node = parseFilterBinaryOperation(lhs, op, rhs, {
        allowSemiJoin: options.allowSemiJoin ?? true,
        ...(options.outerObject ? { outerObject: options.outerObject } : {}),
      });
    } else {
      const operation = lhs.toOperationNode();

      node =
        operation.kind === "DateFunctionNode" ||
        operation.kind === "FormulaFunctionNode" ||
        operation.kind === "ToLabelFunctionNode"
          ? parseOperationValueBinaryOperation(operation, op, rhs)
          : parseDistanceFilterBinaryOperation(
              lhs as DistanceFunctionExpression<unknown, boolean, boolean>,
              op as DistanceComparisonOperator,
              rhs,
            );
    }

    return new ExpressionWrapperImpl<DB, TB, boolean>(node);
  };

  const and = (
    expressions: readonly [
      ExpressionWrapper<DB, TB, boolean>,
      ExpressionWrapper<DB, TB, boolean>,
      ...ExpressionWrapper<DB, TB, boolean>[],
    ],
  ): ExpressionWrapper<DB, TB, boolean> => {
    const [first, second, ...rest] = expressions;
    let operation = AndNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = AndNode.create(operation, item.toOperationNode());
    }

    return new ExpressionWrapperImpl<DB, TB, boolean>(operation);
  };

  const not = (
    operand: ExpressionWrapper<DB, TB, false>,
  ): ExpressionWrapper<DB, TB, false> =>
    new ExpressionWrapperImpl<DB, TB, false>(
      NotNode.create(operand.toOperationNode()),
    );

  const or = (
    expressions: readonly [
      ExpressionWrapper<DB, TB, false>,
      ExpressionWrapper<DB, TB, false>,
      ...ExpressionWrapper<DB, TB, false>[],
    ],
  ): ExpressionWrapper<DB, TB, false> => {
    const [first, second, ...rest] = expressions;
    let operation = OrNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = OrNode.create(operation, item.toOperationNode());
    }

    return new ExpressionWrapperImpl<DB, TB, false>(operation);
  };

  const beta = createBetaExpressionModule<DB, TB>();
  const fn = createSelectExpressionBuilder<DB, TB>()
    .fn as unknown as FilterFunctionModule<DB, TB>;

  return Object.assign(expression, {
    and,
    beta,
    fn,
    not,
    or,
  }) as ExpressionBuilder<DB, TB, AllowSemiJoin>;
}
