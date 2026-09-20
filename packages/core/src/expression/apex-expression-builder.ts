import {
  createGeolocationFilterExpressionBuilder,
  type DistanceFunctionExpression,
  type GeolocationFilterFunctionModule,
} from "#/expression/geolocation-function-builder";
import { AndNode } from "#/operation-node/and-node";
import { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import { OrNode } from "#/operation-node/or-node";
import {
  type ApexOperandValueExpression,
  parseApexFilterBinaryOperation,
} from "#/parser/apex-bind-parser";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
} from "#/parser/binary-operation-parser";
import {
  type DistanceComparisonOperator,
  parseDistanceFilterBinaryOperation,
} from "#/parser/geolocation-expression-parser";

declare const apexExpressionType: unique symbol;

type SemiJoinFlag<Value> = Value extends (...args: never[]) => unknown
  ? true
  : false;

type ExpressionSemiJoinFlag<Expression> = Expression extends {
  readonly [apexExpressionType]: {
    readonly containsSemiJoin: infer ContainsSemiJoin extends boolean;
  };
}
  ? ContainsSemiJoin
  : never;

type CombinedSemiJoinFlag<Expressions extends readonly unknown[]> =
  true extends ExpressionSemiJoinFlag<Expressions[number]> ? true : false;

export interface ApexExpressionWrapper<
  DB,
  TB extends keyof DB,
  ContainsSemiJoin extends boolean = false,
> {
  readonly [apexExpressionType]: {
    readonly db: DB;
    readonly table: TB;
    readonly containsSemiJoin: ContainsSemiJoin;
  };

  toOperationNode(): OperationNode;
}

export interface ApexExpressionBuilder<DB, TB extends keyof DB> {
  <Output, Sortable extends boolean>(
    lhs: DistanceFunctionExpression<Output, true, Sortable>,
    op: DistanceComparisonOperator,
    rhs: number,
  ): ApexExpressionWrapper<DB, TB, false>;

  <
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends ApexOperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): ApexExpressionWrapper<DB, TB, SemiJoinFlag<RHS>>;

  and<
    Expressions extends readonly [
      ApexExpressionWrapper<DB, TB, boolean>,
      ApexExpressionWrapper<DB, TB, boolean>,
      ...ApexExpressionWrapper<DB, TB, boolean>[],
    ],
  >(
    expressions: Expressions,
  ): ApexExpressionWrapper<DB, TB, CombinedSemiJoinFlag<Expressions>>;

  not(
    expression: ApexExpressionWrapper<DB, TB, false>,
  ): ApexExpressionWrapper<DB, TB, false>;

  or(
    expressions: readonly [
      ApexExpressionWrapper<DB, TB, false>,
      ApexExpressionWrapper<DB, TB, false>,
      ...ApexExpressionWrapper<DB, TB, false>[],
    ],
  ): ApexExpressionWrapper<DB, TB, false>;

  readonly fn: GeolocationFilterFunctionModule<DB, TB>;
}

export type ApexWhereExpressionFactory<DB, TB extends keyof DB> = (
  eb: ApexExpressionBuilder<DB, TB>,
) => ApexExpressionWrapper<DB, TB, boolean>;

class ApexExpressionWrapperImpl<
  DB,
  TB extends keyof DB,
  ContainsSemiJoin extends boolean,
> implements ApexExpressionWrapper<DB, TB, ContainsSemiJoin>
{
  declare readonly [apexExpressionType]: {
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

export function createApexExpressionBuilder<DB, TB extends keyof DB>(
  outerObject: string,
): ApexExpressionBuilder<DB, TB> {
  const expression = (
    lhs: string | DistanceFunctionExpression<unknown, boolean, boolean>,
    op: ComparisonOperator,
    rhs: unknown,
  ): ApexExpressionWrapper<DB, TB, boolean> => {
    const node =
      typeof lhs === "string"
        ? parseApexFilterBinaryOperation(lhs, op, rhs, outerObject)
        : parseDistanceFilterBinaryOperation(
            lhs,
            op as DistanceComparisonOperator,
            rhs,
          );

    return new ApexExpressionWrapperImpl<DB, TB, boolean>(node);
  };

  const and = (
    expressions: readonly [
      ApexExpressionWrapper<DB, TB, boolean>,
      ApexExpressionWrapper<DB, TB, boolean>,
      ...ApexExpressionWrapper<DB, TB, boolean>[],
    ],
  ): ApexExpressionWrapper<DB, TB, boolean> => {
    const [first, second, ...rest] = expressions;
    let operation = AndNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = AndNode.create(operation, item.toOperationNode());
    }

    return new ApexExpressionWrapperImpl<DB, TB, boolean>(operation);
  };

  const not = (
    operand: ApexExpressionWrapper<DB, TB, false>,
  ): ApexExpressionWrapper<DB, TB, false> =>
    new ApexExpressionWrapperImpl<DB, TB, false>(
      NotNode.create(operand.toOperationNode()),
    );

  const or = (
    expressions: readonly [
      ApexExpressionWrapper<DB, TB, false>,
      ApexExpressionWrapper<DB, TB, false>,
      ...ApexExpressionWrapper<DB, TB, false>[],
    ],
  ): ApexExpressionWrapper<DB, TB, false> => {
    const [first, second, ...rest] = expressions;
    let operation = OrNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = OrNode.create(operation, item.toOperationNode());
    }

    return new ApexExpressionWrapperImpl<DB, TB, false>(operation);
  };

  const fn = createGeolocationFilterExpressionBuilder<DB, TB>().fn;

  return Object.assign(expression, { and, fn, not, or }) as ApexExpressionBuilder<
    DB,
    TB
  >;
}
