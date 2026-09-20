import * as v from "valibot";

import { ApexBindNode } from "#/operation-node/apex-bind-node";
import {
  ApexAdditionNode,
  type ApexBindExpressionNode,
  type ApexExpressionOperandNode,
} from "#/operation-node/apex-expression-node";
import { ApexLiteralNode } from "#/operation-node/apex-literal-node";

const APEX_BIND_EXPRESSION_ERROR =
  "Apex bind expressions must be identifiers or dotted member paths containing only letters, numbers, and underscores, and no path segment can start with a number.";
const APEX_ADDITION_OPERAND_ERROR =
  "Apex addition operands must be strings, numbers, or Apex bind expressions.";
const apexBindExpressionSchema = v.pipe(
  v.string(),
  v.regex(
    /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/,
    APEX_BIND_EXPRESSION_ERROR,
  ),
);

declare const apexBindValueType: unique symbol;

export interface ApexBindExpression<Value> {
  readonly [apexBindValueType]: Value;
  toOperationNode(): ApexBindExpressionNode;
}

export type ApexAdditionValue = string | number;
export type ApexAdditionOperand<Value extends ApexAdditionValue> =
  | Value
  | ApexBindExpression<Value>;

class ApexBindExpressionImpl<Value> implements ApexBindExpression<Value> {
  declare readonly [apexBindValueType]: Value;

  readonly #node: ApexBindExpressionNode;

  constructor(node: ApexBindExpressionNode) {
    this.#node = node;
  }

  toOperationNode(): ApexBindExpressionNode {
    return this.#node;
  }
}

export function apexBind<Value>(expression: string): ApexBindExpression<Value> {
  const result = v.safeParse(apexBindExpressionSchema, expression);

  if (!result.success) {
    throw new TypeError(APEX_BIND_EXPRESSION_ERROR);
  }

  return new ApexBindExpressionImpl<Value>(ApexBindNode.create(expression));
}

function parseApexAdditionOperand(
  operand: ApexAdditionOperand<ApexAdditionValue>,
): ApexExpressionOperandNode {
  if (isApexBindExpression(operand)) {
    return operand.toOperationNode();
  }

  if (typeof operand !== "string" && typeof operand !== "number") {
    throw new TypeError(APEX_ADDITION_OPERAND_ERROR);
  }

  return ApexLiteralNode.create(operand);
}

export function apexAdd(
  left: ApexAdditionOperand<string>,
  right: ApexAdditionOperand<string>,
): ApexBindExpression<string>;
export function apexAdd(
  left: ApexAdditionOperand<number>,
  right: ApexAdditionOperand<number>,
): ApexBindExpression<number>;
export function apexAdd(
  left: ApexAdditionOperand<ApexAdditionValue>,
  right: ApexAdditionOperand<ApexAdditionValue>,
): ApexBindExpression<ApexAdditionValue> {
  return new ApexBindExpressionImpl<ApexAdditionValue>(
    ApexAdditionNode.create(
      parseApexAdditionOperand(left),
      parseApexAdditionOperand(right),
    ),
  );
}

export function isApexBindExpression(
  value: unknown,
): value is ApexBindExpression<unknown> {
  return value instanceof ApexBindExpressionImpl;
}
