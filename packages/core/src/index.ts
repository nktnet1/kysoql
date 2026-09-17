export type { AndNode } from "./operation-node/and-node.js";
export type { BinaryOperationNode } from "./operation-node/binary-operation-node.js";
export type {
  ComparisonOperator,
  EqualityComparisonOperator,
  LikeComparisonOperator,
  OperatorNode,
  OrderedComparisonOperator,
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
export { QueryCreator, type QueryCreatorConfig } from "./query-creator.js";
export type { CompiledQuery } from "./query-compiler/compiled-query.js";
export { DefaultQueryCompiler } from "./query-compiler/default-query-compiler.js";
export type { QueryCompiler } from "./query-compiler/query-compiler.js";
export type { QueryExecutor } from "./query-executor.js";
export {
  soqlDate,
  soqlDateTime,
  soqlTime,
  type SoqlDateLiteral,
  type SoqlDateTimeLiteral,
  type SoqlTemporalLiteral,
  type SoqlTimeLiteral,
} from "./soql-temporal-literal.js";
export type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceFieldFilterValue,
  SalesforceFieldValue,
  SalesforceObject,
  SalesforceParentRelationship,
  SalesforceRow,
  SalesforceSchema,
} from "./schema.js";

export const kysoql = () => ({
  version: "0.0.0",
});
