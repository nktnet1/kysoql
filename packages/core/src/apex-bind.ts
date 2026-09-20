import * as v from "valibot";

import { ApexBindNode } from "#/operation-node/apex-bind-node";

const APEX_BIND_EXPRESSION_ERROR =
  "Apex bind expressions must be identifiers or dotted member paths containing only letters, numbers, and underscores, and no path segment can start with a number.";
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
  toOperationNode(): ApexBindNode;
}

class ApexBindExpressionImpl<Value> implements ApexBindExpression<Value> {
  declare readonly [apexBindValueType]: Value;

  readonly #node: ApexBindNode;

  constructor(expression: string) {
    this.#node = ApexBindNode.create(expression);
  }

  toOperationNode(): ApexBindNode {
    return this.#node;
  }
}

export function apexBind<Value>(expression: string): ApexBindExpression<Value> {
  const result = v.safeParse(apexBindExpressionSchema, expression);

  if (!result.success) {
    throw new TypeError(APEX_BIND_EXPRESSION_ERROR);
  }

  return new ApexBindExpressionImpl<Value>(expression);
}

export function isApexBindExpression(
  value: unknown,
): value is ApexBindExpression<unknown> {
  return value instanceof ApexBindExpressionImpl;
}
