import * as v from "valibot";

import { BinaryOperationNode } from "#src/operation-node/binary-operation-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import {
  type ComparisonOperator,
  type EqualityComparisonOperator,
  type LikeComparisonOperator,
  type MultiSelectComparisonOperator,
  OperatorNode,
  type OrderedComparisonOperator,
  type SetComparisonOperator,
} from "#src/operation-node/operator-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import { ValueListNode } from "#src/operation-node/value-list-node";
import { ValueNode } from "#src/operation-node/value-node";
import type { FieldReferenceDefinition } from "#src/parser/reference-parser";
import type {
  SemiJoinOperandFieldName,
  SemiJoinSubqueryFactory,
} from "#src/query-builder/semi-join-subquery-builder";
import type { SalesforceFieldFilterValue } from "#src/schema";
import { isSoqlRawBuilder, type SoqlRawBuilder } from "#src/soql";
import {
  isSoqlCurrencyLiteral,
  type SoqlCurrencyLiteral,
} from "#src/soql-currency-literal";
import type { SoqlLikeLiteral } from "#src/soql-like-literal";
import {
  isSoqlMultiSelectAnd,
  type SoqlMultiSelectAnd,
} from "#src/soql-multi-select-literal";

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
  FieldReferenceDefinition<DB, TB, RE> extends {
    readonly salesforceType: infer SalesforceType extends string;
  }
    ? SalesforceType
    : never;

type ActivePicklistValueOfField<DB, TB extends keyof DB, RE extends string> =
  FieldReferenceDefinition<DB, TB, RE> extends {
    readonly activePicklistValue: infer ActivePicklistValue extends string;
  }
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
  | "polymorphicType"
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
  | "polymorphicType"
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

type ScalarComparisonOperatorExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
> =
  | EqualityComparisonOperator
  | OrderedOperatorForField<DB, TB, RE>
  | LikeOperatorForField<DB, TB, RE>
  | SetComparisonOperator
  | MultiSelectOperatorForField<DB, TB, RE>;

export type ComparisonOperatorExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
> =
  SalesforceTypeOfField<DB, TB, RE> extends "location"
    ? never
    : ScalarComparisonOperatorExpression<DB, TB, RE>;

type BaseFieldValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
> = SalesforceFieldFilterValue<FieldReferenceDefinition<DB, TB, RE>>;

type FieldValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  AllowCurrencyLiteral extends boolean,
> =
  | BaseFieldValueExpression<DB, TB, RE>
  | (AllowCurrencyLiteral extends true
      ? SalesforceTypeOfField<DB, TB, RE> extends "currency"
        ? SoqlCurrencyLiteral
        : never
      : never);

type SetValueListExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  AllowCurrencyLiteral extends boolean,
> =
  SalesforceTypeOfField<DB, TB, RE> extends "currency"
    ? AllowCurrencyLiteral extends true
      ?
          | readonly BaseFieldValueExpression<DB, TB, RE>[]
          | readonly SoqlCurrencyLiteral[]
      : readonly BaseFieldValueExpression<DB, TB, RE>[]
    : readonly FieldValueExpression<DB, TB, RE, AllowCurrencyLiteral>[];

export type OperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends string,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
  AllowSemiJoin extends boolean = true,
  AllowCurrencyLiteral extends boolean = true,
> =
  | SoqlRawBuilder
  | (OP extends LikeComparisonOperator
      ? SalesforceTypeOfField<DB, TB, RE> extends "polymorphicType"
        ? string | SoqlLikeLiteral
        :
            | Extract<
                NonNullable<
                  FieldValueExpression<DB, TB, RE, AllowCurrencyLiteral>
                >,
                string
              >
            | SoqlLikeLiteral
      : OP extends OrderedComparisonOperator
        ? NonNullable<FieldValueExpression<DB, TB, RE, AllowCurrencyLiteral>>
        : OP extends SetComparisonOperator
          ?
              | SetValueListExpression<DB, TB, RE, AllowCurrencyLiteral>
              | (AllowSemiJoin extends true
                  ? RE extends SemiJoinOperandFieldName<DB, TB, RE>
                    ? SemiJoinSubqueryFactory<DB, TB, RE>
                    : never
                  : never)
          : OP extends MultiSelectComparisonOperator
            ?
                | readonly (
                    | ActivePicklistValueOfField<DB, TB, RE>
                    | SoqlMultiSelectAnd<ActivePicklistValueOfField<DB, TB, RE>>
                  )[]
                | SoqlMultiSelectAnd<ActivePicklistValueOfField<DB, TB, RE>>
            : FieldValueExpression<DB, TB, RE, AllowCurrencyLiteral>);

const SET_VALUE_LIST_ERROR =
  "SOQL IN/NOT IN value lists must contain at least one value.";
const MULTISELECT_VALUE_LIST_ERROR =
  "SOQL INCLUDES/EXCLUDES value lists must contain at least one value.";
const MIXED_CURRENCY_VALUE_LIST_ERROR =
  "SOQL IN/NOT IN currency value lists cannot mix ISO-coded and non-ISO values.";

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
  const rightOperand = isSoqlRawBuilder(right)
    ? right.toOperationNode()
    : operator === "in" ||
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
  if (
    (operator === "includes" || operator === "excludes") &&
    isSoqlMultiSelectAnd(value)
  ) {
    return ValueListNode.create([value.values.join(";")]);
  }

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

  if (operator === "in" || operator === "not in") {
    const containsIsoCodedCurrency = result.output.some(isSoqlCurrencyLiteral);

    if (
      containsIsoCodedCurrency &&
      result.output.some((item) => !isSoqlCurrencyLiteral(item))
    ) {
      throw new TypeError(MIXED_CURRENCY_VALUE_LIST_ERROR);
    }

    return ValueListNode.create(result.output);
  }

  return ValueListNode.create(
    result.output.map((item) =>
      isSoqlMultiSelectAnd(item) ? item.values.join(";") : item,
    ),
  );
}
