import {
  type FormulaArithmeticOperator,
  FormulaFunctionNode,
} from "#src/operation-node/formula-function-node";
import type {
  EqualityComparisonOperator,
  OrderedComparisonOperator,
} from "#src/operation-node/operator-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import type { FilterableFieldName } from "#src/parser/binary-operation-parser";
import type { FieldReferenceDefinition } from "#src/parser/reference-parser";
import type {
  SoqlDateLiteral,
  SoqlDateTimeLiteral,
} from "#src/soql-temporal-literal";
import { freeze } from "#src/util/object-utils";

declare const formulaFilterExpressionType: unique symbol;

/** Comparison operators supported by formula filter functions. */
export type FormulaFilterComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator;

type FormulaNumericSalesforceType = "currency" | "double" | "int";
type FormulaTemporalSalesforceType = "date" | "datetime";
type FormulaSalesforceType =
  | FormulaNumericSalesforceType
  | FormulaTemporalSalesforceType;

type FormulaSalesforceTypeOfReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> =
  FieldReferenceDefinition<DB, TB, Reference> extends {
    readonly salesforceType: infer SalesforceType extends string;
  }
    ? SalesforceType
    : never;

/**
 * Restricts a field reference to fields accepted by formula filter
 * functions.
 */
export type FilterableFormulaFieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? Reference extends FilterableFieldName<DB, TB, Reference>
    ? FormulaSalesforceTypeOfReference<
        DB,
        TB,
        Reference
      > extends FormulaSalesforceType
      ? Reference
      : never
    : never
  : never;

type FormulaResultValue<
  DB,
  TB extends keyof DB,
  Left extends string,
  Operator extends FormulaArithmeticOperator,
  Right extends string,
> =
  FormulaSalesforceTypeOfReference<DB, TB, Left> extends infer LeftType
    ? FormulaSalesforceTypeOfReference<DB, TB, Right> extends infer RightType
      ? LeftType extends FormulaNumericSalesforceType
        ? RightType extends FormulaNumericSalesforceType
          ? number
          : never
        : LeftType extends "date"
          ? RightType extends "date"
            ? Operator extends "-"
              ? number
              : never
            : RightType extends FormulaNumericSalesforceType
              ? SoqlDateLiteral
              : never
          : LeftType extends "datetime"
            ? RightType extends "datetime"
              ? Operator extends "-"
                ? number
                : never
              : RightType extends FormulaNumericSalesforceType
                ? SoqlDateTimeLiteral
                : never
            : never
      : never
    : never;

type FormulaRightFieldReference<
  DB,
  TB extends keyof DB,
  Left extends string,
  Operator extends FormulaArithmeticOperator,
  Right extends string,
> =
  Right extends FilterableFormulaFieldReference<DB, TB, Right>
    ? [FormulaResultValue<DB, TB, Left, Operator, Right>] extends [never]
      ? never
      : Right
    : never;

/** Typed formula-function expression used in WHERE comparisons. */
export interface FormulaFilterFunctionExpression<Value> {
  /** Type-only marker used to preserve this expression capability through TypeScript inference. */
  readonly [formulaFilterExpressionType]: {
    /** Comparison value type produced by the formula expression. */
    readonly value: Value;
  };

  /** Returns the immutable operation node represented by this expression. */
  toOperationNode(): FormulaFunctionNode;
}

/**
 * Beta expression helpers for Salesforce formula-field filter functions.
 */
export interface BetaExpressionModule<DB, TB extends keyof DB> {
  /** Builds a beta formula expression for a filter predicate. */
  formula<
    Left extends string,
    Operator extends FormulaArithmeticOperator,
    Right extends string,
  >(
    left: Left & FilterableFormulaFieldReference<DB, TB, Left>,
    operator: Operator,
    right: Right & FormulaRightFieldReference<DB, TB, Left, Operator, Right>,
  ): FormulaFilterFunctionExpression<
    FormulaResultValue<DB, TB, Left, Operator, Right>
  >;
}

class FormulaFilterFunctionExpressionImpl<Value>
  implements FormulaFilterFunctionExpression<Value>
{
  declare readonly [formulaFilterExpressionType]: {
    readonly value: Value;
  };

  readonly #node: FormulaFunctionNode;

  constructor(node: FormulaFunctionNode) {
    this.#node = node;
  }

  toOperationNode(): FormulaFunctionNode {
    return this.#node;
  }
}

export function createBetaExpressionModule<
  DB,
  TB extends keyof DB,
>(): BetaExpressionModule<DB, TB> {
  return freeze({
    formula: (
      left: string,
      operator: FormulaArithmeticOperator,
      right: string,
    ): FormulaFilterFunctionExpression<unknown> =>
      new FormulaFilterFunctionExpressionImpl(
        FormulaFunctionNode.create(
          ReferenceNode.create(left),
          operator,
          ReferenceNode.create(right),
        ),
      ),
  }) as BetaExpressionModule<DB, TB>;
}
