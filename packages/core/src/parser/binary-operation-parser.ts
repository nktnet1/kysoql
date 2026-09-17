import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import {
  OperatorNode,
  type ComparisonOperator,
  type EqualityComparisonOperator,
  type LikeComparisonOperator,
  type OrderedComparisonOperator,
} from "#/operation-node/operator-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { ValueNode } from "#/operation-node/value-node";
import type {
  SalesforceField,
  SalesforceFieldFilterValue,
} from "#/schema";
import type {
  FieldDefinition,
  FieldName,
  FieldsOf,
} from "#/parser/reference-parser";

export type FilterableFieldName<DB, TB extends keyof DB> = {
  [Field in FieldName<DB, TB>]: FieldsOf<DB, TB>[Field] extends {
    readonly filterable: true;
  }
    ? Field
    : never;
}[FieldName<DB, TB>];

type SalesforceTypeOfField<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> = FieldDefinition<
  DB,
  TB,
  Extract<RE, FieldName<DB, TB>>
> extends SalesforceField<
  unknown,
  infer SalesforceType,
  boolean,
  boolean,
  boolean,
  boolean,
  string,
  string,
  string
>
  ? SalesforceType
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

type OrderedOperatorForField<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> = SalesforceTypeOfField<DB, TB, RE> extends OrderedSalesforceType
  ? OrderedComparisonOperator
  : never;

type LikeOperatorForField<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> = SalesforceTypeOfField<DB, TB, RE> extends LikeSalesforceType
  ? LikeComparisonOperator
  : never;

export type ComparisonOperatorExpression<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> =
  | EqualityComparisonOperator
  | OrderedOperatorForField<DB, TB, RE>
  | LikeOperatorForField<DB, TB, RE>;

type FieldValueExpression<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> = SalesforceFieldFilterValue<
  FieldDefinition<DB, TB, Extract<RE, FieldName<DB, TB>>>
>;

export type OperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
  OP extends ComparisonOperatorExpression<DB, TB, RE>,
> = OP extends LikeComparisonOperator
  ? Extract<NonNullable<FieldValueExpression<DB, TB, RE>>, string>
  : OP extends OrderedComparisonOperator
    ? NonNullable<FieldValueExpression<DB, TB, RE>>
    : FieldValueExpression<DB, TB, RE>;

export function parseValueBinaryOperation(
  left: string,
  operator: ComparisonOperator,
  right: unknown,
): BinaryOperationNode {
  return BinaryOperationNode.create(
    ReferenceNode.create(left),
    OperatorNode.create(operator),
    ValueNode.create(right),
  );
}
