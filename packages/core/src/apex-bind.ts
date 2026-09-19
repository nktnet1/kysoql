import * as v from "valibot";

import { ApexBindNode } from "#/operation-node/apex-bind-node";

const APEX_BIND_NAME_ERROR =
  "Apex bind names must be simple identifiers containing only letters, numbers, and underscores, and must not start with a number.";
const apexBindNameSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/, APEX_BIND_NAME_ERROR),
);

declare const apexBindValueType: unique symbol;

export interface ApexBindExpression<Value> {
  readonly [apexBindValueType]: Value;
  toOperationNode(): ApexBindNode;
}

class ApexBindExpressionImpl<Value> implements ApexBindExpression<Value> {
  declare readonly [apexBindValueType]: Value;

  readonly #node: ApexBindNode;

  constructor(name: string) {
    this.#node = ApexBindNode.create(name);
  }

  toOperationNode(): ApexBindNode {
    return this.#node;
  }
}

export function apexBind<Value>(name: string): ApexBindExpression<Value> {
  const result = v.safeParse(apexBindNameSchema, name);

  if (!result.success) {
    throw new TypeError(APEX_BIND_NAME_ERROR);
  }

  return new ApexBindExpressionImpl<Value>(name);
}

export function isApexBindExpression(
  value: unknown,
): value is ApexBindExpression<unknown> {
  return value instanceof ApexBindExpressionImpl;
}
