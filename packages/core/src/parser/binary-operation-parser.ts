import * as v from "valibot";

import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { OperationNode } from "#/operation-node/operation-node";
import {
  type ComparisonOperator,
  type EqualityComparisonOperator,
  type LikeComparisonOperator,
  type MultiSelectComparisonOperator,
  OperatorNode,
  type OrderedComparisonOperator,
  type SetComparisonOperator,
} from "#/operation-node/operator-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { ValueListNode } from "#/operation-node/value-list-node";
import { ValueNode } from "#/operation-node/value-node";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";
import type {
  SemiJoinOperandFieldName,
  SemiJoinSubqueryFactory,
} from "#/query-builder/semi-join-subquery-builder";
import type { SalesforceField, SalesforceFieldFilterValue } from "#/schema";

export type FilterableFieldName<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly filterable: true;
        }
      ? Reference
      : never
  : never;

type SalesforceTypeOfField<DB, TB extends keyof DB, RE extends string> =
  FieldReferenceDefinition<DB, TB, RE> extends SalesforceField<
    unknown,
    infer SalesforceType,
    boolean,
    boolean,
    boolean,
    boolean,
    string,
    string,
    string,
    boolean
  >
    ? SalesforceType
    : never;

type ActivePicklistValueOfField<DB, TB extends keyof DB, RE extends string> =
  FieldReferenceDefinition<DB, TB, RE> extends SalesforceField<
    unknown,
    string,
    boolean,
    boolean,
    boolean,
    boolean,
    string,
    string,
    infer ActivePicklistValue,
    boolean
  >
    ? ActivePicklistValue
    : never;

type OrderedSalesforceType =
  | "currency"
  | "date"
  | "datetime"
  | "double"
  | "email"
  | "id"
  | "int"
  | "percent"
  | "phone"
  | "reference"
  | "string"
  | "textarea"
  | "time"
  | "url";

type LikeSalesforceType =
  | "combobox"
  | "email"
  | "phone"
  | "picklist"
  | "string"
  | "textarea"
  | "url";

type OrderedOperatorForField<DB, TB extends keyof DB, RE extends string> =
  SalesforceTypeOfField<DB, TB, RE> extends OrderedSalesforceType
    ? OrderedComparisonOperator
    : never;

type LikeOperatorForField<DB, TB extends keyof DB, RE extends string> =
  SalesforceTypeOfField<DB, TB, RE> extends LikeSalesforceType
    ? LikeComparisonOperator
    : never;

type MultiSelectOperatorForField<DB, TB extends keyof DB, RE extends string> =
  SalesforceTypeOfField<DB, TB, RE> extends "multipicklist"
    ? MultiSelectComparisonOperator
    : never;

export type ComparisonOperatorExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
> =
  | EqualityComparisonOperator
  | OrderedOperatorForField<DB, TB, RE>
  | LikeOperatorForField<DB, TB, RE>
  | SetComparisonOperator
  | MultiSelectOperatorForField<DB, TB, RE>;

type FieldValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
> = SalesforceFieldFilterValue<FieldReferenceDefinition<DB, TB, RE>>;

export type OperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
  AllowSemiJoin extends boolean = true,
> = OP extends LikeComparisonOperator
  ? Extract<NonNullable<FieldValueExpression<DB, TB, RE>>, string>
  : OP extends OrderedComparisonOperator
    ? NonNullable<FieldValueExpression<DB, TB, RE>>
    : OP extends SetComparisonOperator
      ?
          | readonly FieldValueExpression<DB, TB, RE>[]
          | (AllowSemiJoin extends true
              ? RE extends SemiJoinOperandFieldName<DB, TB, RE>
                ? SemiJoinSubqueryFactory<DB, TB, RE>
                : never
              : never)
      : OP extends MultiSelectComparisonOperator
        ? readonly ActivePicklistValueOfField<DB, TB, RE>[]
        : FieldValueExpression<DB, TB, RE>;

const SET_VALUE_LIST_ERROR =
  "SOQL IN/NOT IN value lists must contain at least one value.";
const MULTISELECT_VALUE_LIST_ERROR =
  "SOQL INCLUDES/EXCLUDES value lists must contain at least one value.";

export function parseValueBinaryOperation(
  left: string,
  operator: ComparisonOperator,
  right: unknown,
): BinaryOperationNode {
  return parseOperationValueBinaryOperation(
    ReferenceNode.create(left),
    operator,
    right,
  );
}

export function parseOperationValueBinaryOperation(
  leftOperand: OperationNode,
  operator: ComparisonOperator,
  right: unknown,
): BinaryOperationNode {
  const rightOperand =
    operator === "in" ||
    operator === "not in" ||
    operator === "includes" ||
    operator === "excludes"
      ? parseValueList(right, operator)
      : ValueNode.create(right);

  return BinaryOperationNode.create(
    leftOperand,
    OperatorNode.create(operator),
    rightOperand,
  );
}

function parseValueList(
  value: unknown,
  operator: SetComparisonOperator | MultiSelectComparisonOperator,
): ValueListNode {
  const error =
    operator === "includes" || operator === "excludes"
      ? MULTISELECT_VALUE_LIST_ERROR
      : SET_VALUE_LIST_ERROR;
  const result = v.safeParse(
    v.pipe(v.array(v.unknown()), v.minLength(1, error)),
    value,
  );

  if (!result.success) {
    throw new TypeError(error);
  }

  return ValueListNode.create(result.output);
}
