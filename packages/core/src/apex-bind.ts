import * as v from "valibot";

import { ApexBindNode } from "#src/operation-node/apex-bind-node";
import {
  ApexAdditionNode,
  type ApexBindExpressionNode,
  type ApexExpressionOperandNode,
  ApexQueryResultNode,
  ApexSubstringNode,
} from "#src/operation-node/apex-expression-node";
import { ApexLiteralNode } from "#src/operation-node/apex-literal-node";
import type { ApexSelectQueryBuilder } from "#src/query-builder/apex-select-query-builder";

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

declare const apexDatabaseQueryOptionsType: unique symbol;

/**
 * Compile-time marker for Salesforce `Database.QueryOptions`.
 *
 * Kysoql never constructs this Apex value. Use it only as the value type for
 * an `apexBind()` that names the `Database.QueryOptions` variable available to
 * the generated dynamic SOQL.
 */
export interface ApexDatabaseQueryOptions {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [apexDatabaseQueryOptionsType]: true;
}

/**
 * Typed Apex expression that can be embedded as a bind in generated dynamic
 * SOQL.
 */
export interface ApexBindExpression<Value> {
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [apexBindValueType]: Value;
  /** Returns the immutable operation node represented by this builder. */
  toOperationNode(): ApexBindExpressionNode;
}

/** Primitive value types supported by Apex addition expressions. */
export type ApexAdditionValue = string | number;
/** Literal or typed Apex bind expression accepted by apexAdd(). */
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

/**
 * Creates a typed Apex bind expression from an identifier or dotted member
 * path.
 */
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

/**
 * Builds a typed Apex addition expression from compatible literal or bind
 * operands.
 */
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

/**
 * Builds a typed Apex substring expression using validated zero-based
 * indexes.
 */
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

/**
 * References a selected field from an Apex query result for use in another
 * bind expression.
 */
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
