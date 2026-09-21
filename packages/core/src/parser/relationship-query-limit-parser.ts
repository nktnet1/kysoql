import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import type { ConvertTimezoneFunctionNode } from "#/operation-node/convert-timezone-function-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { DistanceFunctionNode } from "#/operation-node/distance-function-node";
import type { FormatFunctionNode } from "#/operation-node/format-function-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { SelectionNode } from "#/operation-node/selection-node";
import type { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import type { ToLabelFunctionNode } from "#/operation-node/to-label-function-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";

const MAX_PARENT_TO_CHILD_RELATIONSHIPS = 20;
const MAX_CHILD_TO_PARENT_RELATIONSHIPS = 55;

const PARENT_TO_CHILD_RELATIONSHIP_ERROR =
  "SOQL queries can specify no more than 20 parent-to-child relationships.";
const CHILD_TO_PARENT_RELATIONSHIP_ERROR =
  "SOQL queries can specify no more than 55 child-to-parent relationships.";

const RELATIONSHIP_SUBQUERY_OFFSET_PARENT_LIMIT_ERROR =
  "SOQL relationship-subquery OFFSET pilot requires the immediate parent query to use a literal LIMIT 1.";

interface RelationshipCounts {
  readonly parentToChild: Set<string>;
  readonly childToParent: Set<string>;
}

const normalizePath = (value: string): string => value.toLowerCase();

const relationshipScope = (scope: string, relationship: string): string =>
  `${scope}>${normalizePath(relationship)}`;

const collectReferenceRelationships = (
  reference: ReferenceNode,
  scope: string,
  counts: RelationshipCounts,
  includeTerminal = false,
): void => {
  const segments = reference.name.split(".");
  const relationshipSegmentCount = includeTerminal
    ? segments.length
    : Math.max(segments.length - 1, 0);

  for (let index = 1; index <= relationshipSegmentCount; index += 1) {
    counts.childToParent.add(
      `${scope}|${normalizePath(segments.slice(0, index).join("."))}`,
    );
  }
};

const collectTypeOfRelationships = (
  node: TypeOfNode,
  scope: string,
  counts: RelationshipCounts,
  singleRootRecord: boolean,
): void => {
  collectReferenceRelationships(node.reference, scope, counts, true);

  const referencePath = normalizePath(node.reference.name);

  for (const when of node.whens) {
    const branchScope = `${scope}|typeof:${referencePath}:${when.object.toLowerCase()}`;

    // Salesforce counts each explicitly queried polymorphic target against the
    // child-to-parent relationship limit in addition to the polymorphic
    // relationship itself, except when the root query is constrained to one
    // record by Id equality.
    if (!singleRootRecord) {
      counts.childToParent.add(branchScope);
    }

    for (const selection of when.selections) {
      collectReferenceRelationships(selection, branchScope, counts);
    }
  }

  if (node.elseSelections) {
    const elseScope = `${scope}|typeof:${referencePath}:else`;
    for (const selection of node.elseSelections) {
      collectReferenceRelationships(selection, elseScope, counts);
    }
  }
};

const collectRelationshipSubquery = (
  query: RelationshipSubqueryNode,
  scope: string,
  counts: RelationshipCounts,
): void => {
  const childScope = relationshipScope(scope, query.relationship.name);
  counts.parentToChild.add(childScope);

  for (const selection of query.selections ?? []) {
    collectSelectionRelationships(selection, childScope, counts, false);
  }

  if (query.where) {
    collectOperationRelationships(query.where.where, childScope, counts);
  }

  for (const item of query.orderBy?.items ?? []) {
    collectOperationRelationships(item.orderBy, childScope, counts);
  }
};

const collectSemiJoinRelationships = (
  query: SemiJoinSubqueryNode,
  scope: string,
  counts: RelationshipCounts,
): void => {
  const semiJoinScope = `${scope}|semijoin:${query.from.name.toLowerCase()}`;

  if (query.selection) {
    collectReferenceRelationships(query.selection, semiJoinScope, counts);
  }

  if (query.where) {
    collectOperationRelationships(query.where.where, semiJoinScope, counts);
  }
};

const collectOperationRelationships = (
  node: OperationNode,
  scope: string,
  counts: RelationshipCounts,
): void => {
  switch (node.kind) {
    case "AggregateFunctionNode": {
      const aggregate = node as AggregateFunctionNode;
      if (aggregate.reference) {
        collectReferenceRelationships(aggregate.reference, scope, counts);
      }
      return;
    }
    case "AliasNode":
      collectOperationRelationships((node as AliasNode).node, scope, counts);
      return;
    case "AndNode": {
      const and = node as AndNode;
      collectOperationRelationships(and.left, scope, counts);
      collectOperationRelationships(and.right, scope, counts);
      return;
    }
    case "BinaryOperationNode": {
      const binary = node as BinaryOperationNode;
      collectOperationRelationships(binary.leftOperand, scope, counts);
      collectOperationRelationships(binary.rightOperand, scope, counts);
      return;
    }
    case "ConvertCurrencyFunctionNode":
      collectReferenceRelationships(
        (node as ConvertCurrencyFunctionNode).reference,
        scope,
        counts,
      );
      return;
    case "ConvertTimezoneFunctionNode":
      collectReferenceRelationships(
        (node as ConvertTimezoneFunctionNode).reference,
        scope,
        counts,
      );
      return;
    case "DateFunctionNode":
      collectOperationRelationships(
        (node as DateFunctionNode).reference,
        scope,
        counts,
      );
      return;
    case "DistanceFunctionNode": {
      const distance = node as DistanceFunctionNode;
      collectReferenceRelationships(distance.location, scope, counts);
      if (distance.destination.kind === "ReferenceNode") {
        collectReferenceRelationships(distance.destination, scope, counts);
      }
      return;
    }
    case "FormatFunctionNode":
      collectOperationRelationships(
        (node as FormatFunctionNode).expression,
        scope,
        counts,
      );
      return;
    case "NotNode":
      collectOperationRelationships((node as NotNode).operand, scope, counts);
      return;
    case "OrNode": {
      const or = node as OrNode;
      collectOperationRelationships(or.left, scope, counts);
      collectOperationRelationships(or.right, scope, counts);
      return;
    }
    case "ReferenceNode":
      collectReferenceRelationships(node as ReferenceNode, scope, counts);
      return;
    case "SemiJoinSubqueryNode":
      collectSemiJoinRelationships(node as SemiJoinSubqueryNode, scope, counts);
      return;
    case "ToLabelFunctionNode":
      collectReferenceRelationships(
        (node as ToLabelFunctionNode).reference,
        scope,
        counts,
      );
      return;
    default:
      return;
  }
};

const collectSelectionRelationships = (
  selection: SelectionNode,
  scope: string,
  counts: RelationshipCounts,
  singleRootRecord: boolean,
): void => {
  switch (selection.selection.kind) {
    case "RelationshipSubqueryNode":
      collectRelationshipSubquery(
        selection.selection as RelationshipSubqueryNode,
        scope,
        counts,
      );
      return;
    case "TypeOfNode":
      collectTypeOfRelationships(
        selection.selection as TypeOfNode,
        scope,
        counts,
        singleRootRecord,
      );
      return;
    default:
      collectOperationRelationships(selection.selection, scope, counts);
  }
};

const guaranteesSingleRootRecordById = (node: OperationNode): boolean => {
  if (node.kind === "AndNode") {
    const and = node as AndNode;
    return (
      guaranteesSingleRootRecordById(and.left) ||
      guaranteesSingleRootRecordById(and.right)
    );
  }

  if (node.kind !== "BinaryOperationNode") {
    return false;
  }

  const binary = node as BinaryOperationNode;
  return (
    binary.leftOperand.kind === "ReferenceNode" &&
    (binary.leftOperand as ReferenceNode).name.toLowerCase() === "id" &&
    binary.operator.kind === "OperatorNode" &&
    (binary.operator as OperatorNode).operator === "="
  );
};

type RelationshipSubqueryParentLimit =
  | SelectQueryNode["limit"]
  | RelationshipSubqueryNode["limit"];

// A bound Apex LIMIT could evaluate to 1 at runtime, but that cannot be proven
// while compiling. Keep this pilot boundary intentionally stricter and require
// the documented parent LIMIT 1 to be a literal.
const hasLiteralLimitOne = (limit: RelationshipSubqueryParentLimit): boolean =>
  limit?.limit === 1;

const validateRelationshipSubqueryOffsetSelections = (
  selections: ReadonlyArray<SelectionNode> | undefined,
  parentLimit: RelationshipSubqueryParentLimit,
): void => {
  for (const selection of selections ?? []) {
    if (selection.selection.kind !== "RelationshipSubqueryNode") {
      continue;
    }

    const subquery = selection.selection as RelationshipSubqueryNode;

    if (subquery.offset && !hasLiteralLimitOne(parentLimit)) {
      throw new TypeError(RELATIONSHIP_SUBQUERY_OFFSET_PARENT_LIMIT_ERROR);
    }

    validateRelationshipSubqueryOffsetSelections(
      subquery.selections,
      subquery.limit,
    );
  }
};

export const validateRelationshipSubqueryOffsets = (
  query: SelectQueryNode,
): void => {
  validateRelationshipSubqueryOffsetSelections(query.selections, query.limit);
};

export const validateRelationshipQueryLimits = (
  query: SelectQueryNode,
): void => {
  const counts: RelationshipCounts = {
    parentToChild: new Set<string>(),
    childToParent: new Set<string>(),
  };
  const rootScope = `root:${query.from.name.toLowerCase()}`;
  const singleRootRecord = query.where
    ? guaranteesSingleRootRecordById(query.where.where)
    : false;

  for (const selection of query.selections ?? []) {
    collectSelectionRelationships(
      selection,
      rootScope,
      counts,
      singleRootRecord,
    );
  }

  if (query.where) {
    collectOperationRelationships(query.where.where, rootScope, counts);
  }

  for (const item of query.groupBy?.items ?? []) {
    collectOperationRelationships(item, rootScope, counts);
  }

  if (query.having) {
    collectOperationRelationships(query.having.having, rootScope, counts);
  }

  for (const item of query.orderBy?.items ?? []) {
    collectOperationRelationships(item.orderBy, rootScope, counts);
  }

  if (counts.parentToChild.size > MAX_PARENT_TO_CHILD_RELATIONSHIPS) {
    throw new TypeError(PARENT_TO_CHILD_RELATIONSHIP_ERROR);
  }

  if (counts.childToParent.size > MAX_CHILD_TO_PARENT_RELATIONSHIPS) {
    throw new TypeError(CHILD_TO_PARENT_RELATIONSHIP_ERROR);
  }
};
