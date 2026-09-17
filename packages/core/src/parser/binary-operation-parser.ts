import { BinaryOperationNode } from "../operation-node/binary-operation-node.js";
import {
  OperatorNode,
  type ComparisonOperator,
} from "../operation-node/operator-node.js";
import { ReferenceNode } from "../operation-node/reference-node.js";
import { ValueNode } from "../operation-node/value-node.js";
import type { SalesforceFieldValue } from "../schema.js";
import type {
  FieldDefinition,
  FieldName,
  FieldsOf,
} from "./reference-parser.js";

export type ComparisonOperatorExpression = ComparisonOperator;

export type FilterableFieldName<DB, TB extends keyof DB> = {
  [Field in FieldName<DB, TB>]: FieldsOf<DB, TB>[Field] extends {
    readonly filterable: true;
  }
    ? Field
    : never;
}[FieldName<DB, TB>];

export type OperandValueExpression<
  DB,
  TB extends keyof DB,
  RE extends FilterableFieldName<DB, TB>,
> = SalesforceFieldValue<
  FieldDefinition<DB, TB, Extract<RE, FieldName<DB, TB>>>
>;

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
