import { AndNode } from "#/operation-node/and-node";
import { NotNode } from "#/operation-node/not-node";
import { OrNode } from "#/operation-node/or-node";
import type { OperationNode } from "#/operation-node/operation-node";
import {
  parseValueBinaryOperation,
  type ComparisonOperatorExpression,
  type FilterableFieldName,
  type OperandValueExpression,
} from "#/parser/binary-operation-parser";

declare const expressionType: unique symbol;

export interface ExpressionWrapper<DB, TB extends keyof DB> {
  readonly [expressionType]: {
    readonly db: DB;
    readonly table: TB;
  };

  toOperationNode(): OperationNode;
}

export interface ExpressionBuilder<DB, TB extends keyof DB> {
  <
    RE extends FilterableFieldName<DB, TB>,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE,
    op: OP,
    rhs: OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  ): ExpressionWrapper<DB, TB>;

  and(
    expressions: readonly [
      ExpressionWrapper<DB, TB>,
      ExpressionWrapper<DB, TB>,
      ...ExpressionWrapper<DB, TB>[],
    ],
  ): ExpressionWrapper<DB, TB>;

  not(expression: ExpressionWrapper<DB, TB>): ExpressionWrapper<DB, TB>;

  or(
    expressions: readonly [
      ExpressionWrapper<DB, TB>,
      ExpressionWrapper<DB, TB>,
      ...ExpressionWrapper<DB, TB>[],
    ],
  ): ExpressionWrapper<DB, TB>;
}

export type WhereExpressionFactory<DB, TB extends keyof DB> = (
  eb: ExpressionBuilder<DB, TB>,
) => ExpressionWrapper<DB, TB>;

class ExpressionWrapperImpl<DB, TB extends keyof DB>
  implements ExpressionWrapper<DB, TB>
{
  declare readonly [expressionType]: {
    readonly db: DB;
    readonly table: TB;
  };

  readonly #node: OperationNode;

  constructor(node: OperationNode) {
    this.#node = node;
  }

  toOperationNode(): OperationNode {
    return this.#node;
  }
}

export function createExpressionBuilder<DB, TB extends keyof DB>(): ExpressionBuilder<
  DB,
  TB
> {
  const expression = <
    RE extends FilterableFieldName<DB, TB>,
    OP extends ComparisonOperatorExpression<DB, TB, RE>,
  >(
    lhs: RE,
    op: OP,
    rhs: OperandValueExpression<DB, TB, RE, NoInfer<OP>>,
  ): ExpressionWrapper<DB, TB> =>
    new ExpressionWrapperImpl<DB, TB>(
      parseValueBinaryOperation(lhs, op, rhs),
    );

  const and = (
    expressions: readonly [
      ExpressionWrapper<DB, TB>,
      ExpressionWrapper<DB, TB>,
      ...ExpressionWrapper<DB, TB>[],
    ],
  ): ExpressionWrapper<DB, TB> => {
    const [first, second, ...rest] = expressions;
    let operation = AndNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = AndNode.create(operation, item.toOperationNode());
    }

    return new ExpressionWrapperImpl<DB, TB>(operation);
  };

  const not = (
    operand: ExpressionWrapper<DB, TB>,
  ): ExpressionWrapper<DB, TB> =>
    new ExpressionWrapperImpl<DB, TB>(
      NotNode.create(operand.toOperationNode()),
    );

  const or = (
    expressions: readonly [
      ExpressionWrapper<DB, TB>,
      ExpressionWrapper<DB, TB>,
      ...ExpressionWrapper<DB, TB>[],
    ],
  ): ExpressionWrapper<DB, TB> => {
    const [first, second, ...rest] = expressions;
    let operation = OrNode.create(
      first.toOperationNode(),
      second.toOperationNode(),
    );

    for (const item of rest) {
      operation = OrNode.create(operation, item.toOperationNode());
    }

    return new ExpressionWrapperImpl<DB, TB>(operation);
  };

  return Object.assign(expression, { and, not, or });
}
