import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { BinaryOperationNode } from "#src/operation-node/binary-operation-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import type { OperatorNode } from "#src/operation-node/operator-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { SemiJoinSubqueryNode } from "#src/operation-node/semi-join-subquery-node";
import type { ValueNode } from "#src/operation-node/value-node";
import type { SalesforceSchemaMetadata } from "#src/schema";

const DATA360_GROUP_BY_ID_ERROR = "SOQL Data 360 queries cannot GROUP BY Id.";
const DATA360_HAVING_ERROR =
  "SOQL Data 360 HAVING clauses cannot reference Id or COUNT(Id), use IN, or compare with null.";
const DATA360_STRING_ORDER_ERROR =
  "SOQL Data 360 queries do not support >, <, >=, or <= comparisons on string fields.";
const DATA360_PARENT_RELATIONSHIP_ERROR =
  "SOQL Data 360 queries do not support child-to-parent relationships.";
const DATA360_SEMI_JOIN_ERROR =
  "SOQL semi-joins between Data 360 DMOs must use lookup fields on both sides.";

const ORDERED_OPERATORS = new Set([">", "<", ">=", "<="]);

const isData360Object = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.endsWith("__dll") || lower.endsWith("__dlm");
};

const isData360Dmo = (name: string): boolean =>
  name.toLowerCase().endsWith("__dlm");

const walk = (value: unknown, visit: (node: OperationNode) => void): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, visit);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const node = value as OperationNode & Record<string, unknown>;
  if (typeof node.kind !== "string") {
    return;
  }
  visit(node);
  if (node.kind === "ValueNode" || node.kind === "RawNode") {
    return;
  }
  for (const child of Object.values(node)) {
    walk(child, visit);
  }
};

const isIdReference = (node: OperationNode): boolean =>
  node.kind === "ReferenceNode" &&
  (node as ReferenceNode).name.toLowerCase() === "id";

const isCountId = (node: OperationNode): boolean =>
  node.kind === "AggregateFunctionNode" &&
  (node as AggregateFunctionNode).function === "count" &&
  (node as AggregateFunctionNode).reference?.name.toLowerCase() === "id";

const metadataFields = (
  fields: Readonly<Record<string, readonly string[]>> | undefined,
  objectName: string,
): ReadonlySet<string> | undefined => {
  const entry =
    fields?.[objectName] ??
    Object.entries(fields ?? {}).find(
      ([name]) => name.toLowerCase() === objectName.toLowerCase(),
    )?.[1];
  return entry ? new Set(entry.map((field) => field.toLowerCase())) : undefined;
};

const validateHaving = (query: SelectQueryNode): void => {
  if (!query.having) {
    return;
  }
  let invalid = false;
  walk(query.having.having, (node) => {
    if (isIdReference(node) || isCountId(node)) {
      invalid = true;
    }
    if (node.kind !== "BinaryOperationNode") {
      return;
    }
    const binary = node as BinaryOperationNode;
    if (
      binary.operator.kind === "OperatorNode" &&
      (binary.operator as OperatorNode).operator === "in"
    ) {
      invalid = true;
    }
    if (
      (binary.leftOperand.kind === "ValueNode" &&
        (binary.leftOperand as ValueNode).value === null) ||
      (binary.rightOperand.kind === "ValueNode" &&
        (binary.rightOperand as ValueNode).value === null)
    ) {
      invalid = true;
    }
  });
  if (invalid) {
    throw new TypeError(DATA360_HAVING_ERROR);
  }
};

const validateOrderedStringComparisons = (
  query: SelectQueryNode,
  metadata: SalesforceSchemaMetadata | undefined,
): void => {
  const stringFields = metadataFields(
    metadata?.data360StringFields,
    query.from.name,
  );
  if (!stringFields || stringFields.size === 0) {
    return;
  }
  let invalid = false;
  walk([query.where, query.having], (node) => {
    if (node.kind !== "BinaryOperationNode") {
      return;
    }
    const binary = node as BinaryOperationNode;
    if (
      binary.leftOperand.kind !== "ReferenceNode" ||
      binary.operator.kind !== "OperatorNode"
    ) {
      return;
    }
    const field = (binary.leftOperand as ReferenceNode).name.toLowerCase();
    const operator = (binary.operator as OperatorNode).operator;
    if (stringFields.has(field) && ORDERED_OPERATORS.has(operator)) {
      invalid = true;
    }
  });
  if (invalid) {
    throw new TypeError(DATA360_STRING_ORDER_ERROR);
  }
};

const validateNoParentRelationships = (query: SelectQueryNode): void => {
  let invalid = false;
  walk(query, (node) => {
    if (
      node.kind === "ReferenceNode" &&
      (node as ReferenceNode).name.includes(".")
    ) {
      invalid = true;
    }
  });
  if (invalid) {
    throw new TypeError(DATA360_PARENT_RELATIONSHIP_ERROR);
  }
};

const validateDmoSemiJoins = (
  query: SelectQueryNode,
  metadata: SalesforceSchemaMetadata | undefined,
): void => {
  if (!isData360Dmo(query.from.name)) {
    return;
  }
  const outerLookups = metadataFields(
    metadata?.data360LookupFields,
    query.from.name,
  );
  if (!outerLookups) {
    return;
  }
  let invalid = false;
  walk(query.where, (node) => {
    if (node.kind !== "BinaryOperationNode") {
      return;
    }
    const binary = node as BinaryOperationNode;
    if (binary.rightOperand.kind !== "SemiJoinSubqueryNode") {
      return;
    }
    const semiJoin = binary.rightOperand as SemiJoinSubqueryNode;
    if (!isData360Dmo(semiJoin.from.name)) {
      return;
    }
    const innerLookups = metadataFields(
      metadata?.data360LookupFields,
      semiJoin.from.name,
    );
    if (!innerLookups) {
      return;
    }
    const outerField =
      binary.leftOperand.kind === "ReferenceNode"
        ? (binary.leftOperand as ReferenceNode).name.toLowerCase()
        : undefined;
    const innerField = semiJoin.selection?.name.toLowerCase();
    if (
      !outerField ||
      !innerField ||
      !outerLookups.has(outerField) ||
      !innerLookups.has(innerField)
    ) {
      invalid = true;
    }
  });
  if (invalid) {
    throw new TypeError(DATA360_SEMI_JOIN_ERROR);
  }
};

export const validateData360QueryLimits = (
  query: SelectQueryNode,
  metadata?: SalesforceSchemaMetadata,
): void => {
  if (!isData360Object(query.from.name)) {
    return;
  }

  if (query.groupBy?.items.some((item) => isIdReference(item))) {
    throw new TypeError(DATA360_GROUP_BY_ID_ERROR);
  }
  validateHaving(query);
  validateOrderedStringComparisons(query, metadata);
  validateNoParentRelationships(query);
  validateDmoSemiJoins(query, metadata);
};
