import { AndNode } from "#/operation-node/and-node";
import { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { OrNode } from "#/operation-node/or-node";
import type {
  ComparisonOperatorExpression,
  FilterableFieldName,
  OperandValueExpression,
} from "#/parser/binary-operation-parser";
import { parseFilterBinaryOperation } from "#/parser/filter-parser";

declare const expressionType: unique symbol;

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

export interface ExpressionWrapper<
  DB,
  TB extends keyof DB,
  ContainsSemiJoin extends boolean = false,
> {
  readonly [expressionType]: {
    readonly db: DB;
    readonly table: TB;
    readonly containsSemiJoin: ContainsSemiJoin;
  };

  toOperationNode(): OperationNode;
}

export interface ExpressionBuilder<
  DB,
  TB extends keyof DB,
  AllowSemiJoin extends boolean = true,
> {
  <
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, AllowSemiJoin>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): ExpressionWrapper<DB, TB, SemiJoinFlag<RHS>>;

  and<
    Expressions extends readonly [
      ExpressionWrapper<DB, TB, boolean>,
      ExpressionWrapper<DB, TB, boolean>,
      ...ExpressionWrapper<DB, TB, boolean>[],
    ],
  >(
    expressions: Expressions,
  ): ExpressionWrapper<DB, TB, CombinedSemiJoinFlag<Expressions>>;

  not(
    expression: ExpressionWrapper<DB, TB, false>,
  ): ExpressionWrapper<DB, TB, false>;

  or(
    expressions: readonly [
      ExpressionWrapper<DB, TB, false>,
      ExpressionWrapper<DB, TB, false>,
      ...ExpressionWrapper<DB, TB, false>[],
    ],
  ): ExpressionWrapper<DB, TB, false>;
}

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
  const expression = <
    RE extends string,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
    RHS extends OperandValueExpression<DB, TB, RE, NoInfer<OP>, AllowSemiJoin>,
  >(
    lhs: RE & FilterableFieldName<DB, TB, RE>,
    op: OP,
    rhs: RHS,
  ): ExpressionWrapper<DB, TB, SemiJoinFlag<RHS>> =>
    new ExpressionWrapperImpl<DB, TB, SemiJoinFlag<RHS>>(
      parseFilterBinaryOperation(lhs, op, rhs, {
        allowSemiJoin: options.allowSemiJoin ?? true,
        ...(options.outerObject ? { outerObject: options.outerObject } : {}),
      }),
    );

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

  return Object.assign(expression, { and, not, or }) as ExpressionBuilder<
    DB,
    TB,
    AllowSemiJoin
  >;
}
