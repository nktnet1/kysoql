export type { AndNode } from "./operation-node/and-node.js";
export type { BinaryOperationNode } from "./operation-node/binary-operation-node.js";
export type {
  ComparisonOperator,
  OperatorNode,
} from "./operation-node/operator-node.js";
export type { OperationNode } from "./operation-node/operation-node.js";
export { Kysoql } from "./kysoql.js";
export type { ReferenceNode } from "./operation-node/reference-node.js";
export type { SelectQueryNode } from "./operation-node/select-query-node.js";
export type { SelectionNode } from "./operation-node/selection-node.js";
export type { SObjectNode } from "./operation-node/sobject-node.js";
export type { ValueNode } from "./operation-node/value-node.js";
export type { WhereNode } from "./operation-node/where-node.js";
export type {
  SelectQueryBuilder,
  SelectQueryBuilderProps,
} from "./query-builder/select-query-builder.js";
export { QueryCreator } from "./query-creator.js";
export type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceFieldValue,
  SalesforceObject,
  SalesforceParentRelationship,
  SalesforceRow,
  SalesforceSchema,
} from "./schema.js";

export interface CompiledSoql {
  readonly soql: string;
}

export interface SoqlQuery<Result> {
  compile(): CompiledSoql;
  readonly __result?: Result;
}

export const kysoql = () => ({
  version: "0.0.0",
});
