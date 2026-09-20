import * as v from "valibot";

import { ApexBindNode } from "#/operation-node/apex-bind-node";
import {
  ApexAdditionNode,
  ApexQueryResultNode,
  ApexSubstringNode,
  type ApexBindExpressionNode,
  type ApexExpressionOperandNode,
} from "#/operation-node/apex-expression-node";
import { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import type {
  ApexSelectQueryBuilder,
} from "#/query-builder/apex-select-query-builder";

const APEX_BIND_EXPRESSION_ERROR =
  "Apex bind expressions must be identifiers or dotted member paths containing only letters, numbers, and underscores, and no path segment can start with a number.";
const APEX_ADDITION_OPERAND_ERROR =
  "Apex addition operands must be strings, numbers, or Apex bind expressions.";
const APEX_SUBSTRING_SOURCE_ERROR =
  "Apex substring sources must be strings or string-valued Apex bind expressions.";
const APEX_SUBSTRING_INDEX_ERROR =
  "Apex substring indexes must be non-negative integers, and endIndex must be greater than or equal to beginIndex.";
const APEX_QUERY_FIELD_ERROR =
  "Apex query-result fields must be simple selected field names containing only letters, numbers, and underscores, and must not start with a number.";
const apexBindExpressionSchema = v.pipe(
  v.string(),
  v.regex(
    /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/,
    APEX_BIND_EXPRESSION_ERROR,
  ),
);
const apexQueryFieldSchema = v.pipe(
  v.string(),
  v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/, APEX_QUERY_FIELD_ERROR),
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

function parseApexSubstringSource(
  source: string | ApexBindExpression<string>,
): ApexExpressionOperandNode {
  if (isApexBindExpression(source)) {
    return source.toOperationNode();
  }

  if (typeof source !== "string") {
    throw new TypeError(APEX_SUBSTRING_SOURCE_ERROR);
  }

  return ApexLiteralNode.create(source);
}

function validateApexSubstringIndexes(
  beginIndex: number,
  endIndex: number,
): void {
  if (
    !Number.isInteger(beginIndex) ||
    beginIndex < 0 ||
    !Number.isInteger(endIndex) ||
    endIndex < beginIndex
  ) {
    throw new TypeError(APEX_SUBSTRING_INDEX_ERROR);
  }
}

export function apexSubstring(
  source: string | ApexBindExpression<string>,
  beginIndex: number,
  endIndex: number,
): ApexBindExpression<string> {
  validateApexSubstringIndexes(beginIndex, endIndex);

  return new ApexBindExpressionImpl<string>(
    ApexSubstringNode.create(
      parseApexSubstringSource(source),
      beginIndex,
      endIndex,
    ),
  );
}

export function apexQueryField<
  DB,
  TB extends keyof DB,
  Output,
  Field extends Extract<keyof Output, string>,
>(
  query: ApexSelectQueryBuilder<DB, TB, Output, "plain">,
  field: Field,
): ApexBindExpression<Output[Field]> {
  const result = v.safeParse(apexQueryFieldSchema, field);

  if (!result.success) {
    throw new TypeError(APEX_QUERY_FIELD_ERROR);
  }

  return new ApexBindExpressionImpl<Output[Field]>(
    ApexQueryResultNode.create(query.toOperationNode(), field),
  );
}

export function isApexBindExpression(
  value: unknown,
): value is ApexBindExpression<unknown> {
  return value instanceof ApexBindExpressionImpl;
}
