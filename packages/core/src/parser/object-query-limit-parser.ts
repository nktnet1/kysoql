import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { FormatFunctionNode } from "#/operation-node/format-function-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { ToLabelFunctionNode } from "#/operation-node/to-label-function-node";
import type { ValueListNode } from "#/operation-node/value-list-node";
import type { ValueNode } from "#/operation-node/value-node";

interface RequiredRootFilterRule {
  readonly fields: ReadonlySet<string>;
  readonly error: string;
}

const REQUIRED_ROOT_FILTERS = new Map<string, RequiredRootFilterRule>([
  [
    "contentdocumentlink",
    {
      fields: new Set(["id", "contentdocumentid", "linkedentityid"]),
      error:
        "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.",
    },
  ],
  [
    "contenthubitem",
    {
      fields: new Set(["id", "externalid", "contenthubrepositoryid"]),
      error:
        "SOQL ContentHubItem queries require a WHERE predicate on Id, ExternalId, or ContentHubRepositoryId.",
    },
  ],
]);

const VOTE_FILTER_ERROR =
  "SOQL Vote queries require a WHERE predicate using ParentId = <single ID>, Parent.Type = <single type>, Id = <single ID>, or Id IN (<ID list>).";
const USER_RECORD_ACCESS_FILTER_ERROR =
  "SOQL UserRecordAccess queries require UserId = <single ID> and either RecordId = <single ID> or RecordId IN (<up to 200 IDs>), with at most one optional Has*Access = true predicate.";
const USER_RECORD_ACCESS_SELECTION_ERROR =
  "SOQL UserRecordAccess queries must SELECT RecordId and may select only Has*Access fields and MaxAccessLevel; queries filtered by Has*Access = true must SELECT RecordId only.";
const USER_RECORD_ACCESS_ORDER_BY_ERROR =
  "SOQL UserRecordAccess ORDER BY may reference only selected fields, and every selected Has*Access or MaxAccessLevel field must also be ordered.";
const FEED_RELATIONSHIP_ORDER_BY_ERROR =
  "SOQL NewsFeed and UserProfileFeed ORDER BY clauses can reference only fields on the root object.";
const CUSTOM_METADATA_WHERE_ERROR =
  "SOQL custom metadata type WHERE clauses support IN/NOT IN, =, !=, >, >=, <, <=, LIKE, AND, and same-field OR groups using only =/LIKE predicates.";
const CUSTOM_METADATA_ORDER_BY_ERROR =
  "SOQL custom metadata type ORDER BY clauses can reference only non-relationship fields.";
const EXTERNAL_OBJECT_QUERY_ERROR =
  "SOQL external objects do not support GROUP BY, HAVING, fielded COUNT/AVG/MIN/MAX/SUM, LIKE, INCLUDES/EXCLUDES, toLabel(), TYPEOF, FOR VIEW/REFERENCE, or WITH clauses.";

const CUSTOM_METADATA_OPERATORS = new Set([
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "like",
  "in",
  "not in",
]);
const CUSTOM_METADATA_OR_OPERATORS = new Set(["=", "like"]);
const EXTERNAL_OBJECT_UNSUPPORTED_OPERATORS = new Set([
  "like",
  "includes",
  "excludes",
]);
const EXTERNAL_OBJECT_UNSUPPORTED_AGGREGATES = new Set([
  "avg",
  "max",
  "min",
  "sum",
]);

const USER_RECORD_ACCESS_MAX_RECORD_IDS = 200;
const USER_RECORD_ACCESS_FIELDS = new Set([
  "hasreadaccess",
  "haseditaccess",
  "hasdeleteaccess",
  "hastransferaccess",
  "hasallaccess",
]);

type BinaryPredicateMatcher = (node: BinaryOperationNode) => boolean;

const hasMatchingRootPredicate = (
  node: OperationNode,
  matches: BinaryPredicateMatcher,
): boolean => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return (
        hasMatchingRootPredicate(and.left, matches) ||
        hasMatchingRootPredicate(and.right, matches)
      );
    }
    case "BinaryOperationNode":
      return matches(node as BinaryOperationNode);
    case "NotNode":
      return hasMatchingRootPredicate((node as NotNode).operand, matches);
    case "OrNode": {
      const or = node as OrNode;
      return (
        hasMatchingRootPredicate(or.left, matches) ||
        hasMatchingRootPredicate(or.right, matches)
      );
    }
    default:
      return false;
  }
};

const isRequiredRootReference = (
  node: OperationNode,
  fields: ReadonlySet<string>,
): boolean =>
  node.kind === "ReferenceNode" &&
  fields.has((node as ReferenceNode).name.toLowerCase());

const hasRequiredRootPredicate = (
  node: OperationNode,
  fields: ReadonlySet<string>,
): boolean =>
  hasMatchingRootPredicate(node, (binary) =>
    isRequiredRootReference(binary.leftOperand, fields),
  );

const nonEmptyStringValue = (node: OperationNode): boolean => {
  if (node.kind !== "ValueNode") {
    return false;
  }

  const value = (node as ValueNode).value;
  return typeof value === "string" && value.length > 0;
};

const nonEmptyStringValueList = (
  node: OperationNode,
  maximumLength?: number,
): boolean =>
  node.kind === "ValueListNode" &&
  (node as ValueListNode).values.length > 0 &&
  (maximumLength === undefined ||
    (node as ValueListNode).values.length <= maximumLength) &&
  (node as ValueListNode).values.every((value) => nonEmptyStringValue(value));

const trueValue = (node: OperationNode): boolean =>
  node.kind === "ValueNode" && (node as ValueNode).value === true;

const votePredicateMatches = (node: BinaryOperationNode): boolean => {
  if (
    node.leftOperand.kind !== "ReferenceNode" ||
    node.operator.kind !== "OperatorNode"
  ) {
    return false;
  }

  const reference = (node.leftOperand as ReferenceNode).name.toLowerCase();
  const operator = (node.operator as OperatorNode).operator;

  if (reference === "parentid" || reference === "parent.type") {
    return operator === "=" && nonEmptyStringValue(node.rightOperand);
  }

  if (reference !== "id") {
    return false;
  }

  return operator === "="
    ? nonEmptyStringValue(node.rightOperand)
    : operator === "in" && nonEmptyStringValueList(node.rightOperand);
};

const conjunctivePredicates = (
  node: OperationNode,
): readonly BinaryOperationNode[] | undefined => {
  if (node.kind === "BinaryOperationNode") {
    return [node as BinaryOperationNode];
  }

  if (node.kind !== "AndNode") {
    return undefined;
  }

  const and = node as AndNode;
  const left = conjunctivePredicates(and.left);
  const right = conjunctivePredicates(and.right);

  return left && right ? [...left, ...right] : undefined;
};

const isUserRecordAccessAccessField = (field: string): boolean =>
  USER_RECORD_ACCESS_FIELDS.has(field.toLowerCase());

interface UserRecordAccessWhereShape {
  readonly hasAccessPredicate: boolean;
}

const validateUserRecordAccessWhere = (
  query: SelectQueryNode,
): UserRecordAccessWhereShape => {
  const predicates = query.where
    ? conjunctivePredicates(query.where.where)
    : undefined;

  if (!predicates) {
    throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
  }

  let userIdPredicates = 0;
  let recordIdPredicates = 0;
  let accessPredicates = 0;

  for (const predicate of predicates) {
    if (
      predicate.leftOperand.kind !== "ReferenceNode" ||
      predicate.operator.kind !== "OperatorNode"
    ) {
      throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
    }

    const field = (predicate.leftOperand as ReferenceNode).name.toLowerCase();
    const operator = (predicate.operator as OperatorNode).operator;

    if (field === "userid") {
      if (operator !== "=" || !nonEmptyStringValue(predicate.rightOperand)) {
        throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
      }
      userIdPredicates += 1;
      continue;
    }

    if (field === "recordid") {
      const validRecordFilter =
        (operator === "=" && nonEmptyStringValue(predicate.rightOperand)) ||
        (operator === "in" &&
          nonEmptyStringValueList(
            predicate.rightOperand,
            USER_RECORD_ACCESS_MAX_RECORD_IDS,
          ));

      if (!validRecordFilter) {
        throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
      }
      recordIdPredicates += 1;
      continue;
    }

    if (isUserRecordAccessAccessField(field)) {
      if (operator !== "=" || !trueValue(predicate.rightOperand)) {
        throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
      }
      accessPredicates += 1;
      continue;
    }

    throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
  }

  if (
    userIdPredicates !== 1 ||
    recordIdPredicates !== 1 ||
    accessPredicates > 1
  ) {
    throw new TypeError(USER_RECORD_ACCESS_FILTER_ERROR);
  }

  return {
    hasAccessPredicate: accessPredicates === 1,
  };
};

const validateUserRecordAccessSelections = (
  query: SelectQueryNode,
  whereShape: UserRecordAccessWhereShape,
): readonly string[] => {
  const selectedFields = query.selections?.map((selection) => {
    const selected = selection.selection;
    const reference =
      selected.kind === "ReferenceNode"
        ? selected
        : selected.kind === "AliasNode" &&
            selected.node.kind === "ReferenceNode"
          ? (selected.node as ReferenceNode)
          : undefined;

    if (!reference) {
      throw new TypeError(USER_RECORD_ACCESS_SELECTION_ERROR);
    }

    return reference.name.toLowerCase();
  });

  if (
    !selectedFields?.length ||
    !selectedFields.includes("recordid") ||
    new Set(selectedFields).size !== selectedFields.length ||
    selectedFields.some(
      (field) =>
        field !== "recordid" &&
        field !== "maxaccesslevel" &&
        !isUserRecordAccessAccessField(field),
    ) ||
    (whereShape.hasAccessPredicate &&
      (selectedFields.length !== 1 || selectedFields[0] !== "recordid"))
  ) {
    throw new TypeError(USER_RECORD_ACCESS_SELECTION_ERROR);
  }

  return selectedFields;
};

const validateUserRecordAccessOrderBy = (
  query: SelectQueryNode,
  selectedFields: readonly string[],
): void => {
  const selected = new Set(selectedFields);
  const requiredOrderFields = selectedFields.filter(
    (field) =>
      field === "maxaccesslevel" || isUserRecordAccessAccessField(field),
  );
  const orderedFields = new Set<string>();

  for (const item of query.orderBy?.items ?? []) {
    if (item.orderBy.kind !== "ReferenceNode") {
      throw new TypeError(USER_RECORD_ACCESS_ORDER_BY_ERROR);
    }

    const field = (item.orderBy as ReferenceNode).name.toLowerCase();
    if (!selected.has(field)) {
      throw new TypeError(USER_RECORD_ACCESS_ORDER_BY_ERROR);
    }
    orderedFields.add(field);
  }

  if (requiredOrderFields.some((field) => !orderedFields.has(field))) {
    throw new TypeError(USER_RECORD_ACCESS_ORDER_BY_ERROR);
  }
};

const isRelationshipReference = (reference: ReferenceNode): boolean =>
  reference.name.includes(".");

const orderByUsesRelationship = (query: SelectQueryNode): boolean =>
  query.orderBy?.items.some((item) => {
    switch (item.orderBy.kind) {
      case "AggregateFunctionNode":
        return (
          item.orderBy.reference !== undefined &&
          isRelationshipReference(item.orderBy.reference)
        );
      case "DateFunctionNode":
        return isRelationshipReference(
          item.orderBy.reference.kind === "ReferenceNode"
            ? item.orderBy.reference
            : item.orderBy.reference.reference,
        );
      case "DistanceFunctionNode":
        return (
          isRelationshipReference(item.orderBy.location) ||
          (item.orderBy.destination.kind === "ReferenceNode" &&
            isRelationshipReference(item.orderBy.destination))
        );
      case "ReferenceNode":
        return isRelationshipReference(item.orderBy);
    }

    return false;
  }) ?? false;

const validateUserRecordAccessQuery = (query: SelectQueryNode): void => {
  const whereShape = validateUserRecordAccessWhere(query);
  const selectedFields = validateUserRecordAccessSelections(query, whereShape);
  validateUserRecordAccessOrderBy(query, selectedFields);
};

const binaryReferenceAndOperator = (
  node: BinaryOperationNode,
): readonly [string, string] | undefined => {
  if (node.operator.kind !== "OperatorNode") {
    return undefined;
  }

  const reference =
    node.leftOperand.kind === "ReferenceNode"
      ? (node.leftOperand as ReferenceNode)
      : node.leftOperand.kind === "ToLabelFunctionNode"
        ? (node.leftOperand as ToLabelFunctionNode).reference
        : undefined;

  if (!reference) {
    return undefined;
  }

  return [
    reference.name.toLowerCase(),
    (node.operator as OperatorNode).operator,
  ];
};

const collectCustomMetadataOrPredicates = (
  node: OperationNode,
): readonly BinaryOperationNode[] | undefined => {
  if (node.kind === "BinaryOperationNode") {
    return [node as BinaryOperationNode];
  }

  if (node.kind !== "OrNode") {
    return undefined;
  }

  const or = node as OrNode;
  const left = collectCustomMetadataOrPredicates(or.left);
  const right = collectCustomMetadataOrPredicates(or.right);
  return left && right ? [...left, ...right] : undefined;
};

const validateCustomMetadataOr = (node: OrNode): void => {
  const predicates = collectCustomMetadataOrPredicates(node);
  const first = predicates?.[0]
    ? binaryReferenceAndOperator(predicates[0])
    : undefined;

  if (!predicates || !first || !CUSTOM_METADATA_OR_OPERATORS.has(first[1])) {
    throw new TypeError(CUSTOM_METADATA_WHERE_ERROR);
  }

  const field = first[0];
  for (const predicate of predicates.slice(1)) {
    const pair = binaryReferenceAndOperator(predicate);
    if (
      !pair ||
      pair[0] !== field ||
      !CUSTOM_METADATA_OR_OPERATORS.has(pair[1])
    ) {
      throw new TypeError(CUSTOM_METADATA_WHERE_ERROR);
    }
  }
};

const validateCustomMetadataWhere = (node: OperationNode): void => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      validateCustomMetadataWhere(and.left);
      validateCustomMetadataWhere(and.right);
      return;
    }
    case "BinaryOperationNode": {
      const pair = binaryReferenceAndOperator(node as BinaryOperationNode);
      if (!pair || !CUSTOM_METADATA_OPERATORS.has(pair[1])) {
        throw new TypeError(CUSTOM_METADATA_WHERE_ERROR);
      }
      return;
    }
    case "OrNode":
      validateCustomMetadataOr(node as OrNode);
      return;
    default:
      throw new TypeError(CUSTOM_METADATA_WHERE_ERROR);
  }
};

const validateCustomMetadataQuery = (query: SelectQueryNode): void => {
  if (query.where) {
    validateCustomMetadataWhere(query.where.where);
  }

  if (orderByUsesRelationship(query)) {
    throw new TypeError(CUSTOM_METADATA_ORDER_BY_ERROR);
  }
};

const whereUsesOperator = (
  node: OperationNode,
  operators: ReadonlySet<string>,
): boolean => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return (
        whereUsesOperator(and.left, operators) ||
        whereUsesOperator(and.right, operators)
      );
    }
    case "BinaryOperationNode": {
      const binary = node as BinaryOperationNode;
      return (
        binary.operator.kind === "OperatorNode" &&
        operators.has((binary.operator as OperatorNode).operator)
      );
    }
    case "NotNode":
      return whereUsesOperator((node as NotNode).operand, operators);
    case "OrNode": {
      const or = node as OrNode;
      return (
        whereUsesOperator(or.left, operators) ||
        whereUsesOperator(or.right, operators)
      );
    }
    default:
      return false;
  }
};

const whereUsesToLabel = (node: OperationNode): boolean => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return whereUsesToLabel(and.left) || whereUsesToLabel(and.right);
    }
    case "BinaryOperationNode":
      return (
        (node as BinaryOperationNode).leftOperand.kind === "ToLabelFunctionNode"
      );
    case "NotNode":
      return whereUsesToLabel((node as NotNode).operand);
    case "OrNode": {
      const or = node as OrNode;
      return whereUsesToLabel(or.left) || whereUsesToLabel(or.right);
    }
    default:
      return false;
  }
};

const externalSelectionIsUnsupported = (node: OperationNode): boolean => {
  switch (node.kind) {
    case "AggregateFunctionNode": {
      const aggregate = node as AggregateFunctionNode;
      return (
        EXTERNAL_OBJECT_UNSUPPORTED_AGGREGATES.has(aggregate.function) ||
        (aggregate.function === "count" && aggregate.reference !== undefined)
      );
    }
    case "AliasNode":
      return externalSelectionIsUnsupported((node as AliasNode).node);
    case "FormatFunctionNode":
      return externalSelectionIsUnsupported(
        (node as FormatFunctionNode).expression,
      );
    case "ToLabelFunctionNode":
      return true;
    case "TypeOfNode":
      return true;
    default:
      return false;
  }
};

const validateExternalObjectQuery = (query: SelectQueryNode): void => {
  if (
    query.groupBy ||
    query.having ||
    query.forViewReference ||
    query.userProfileFeedWith ||
    query.withDataCategory ||
    query.selections?.some((selection) =>
      externalSelectionIsUnsupported(selection.selection),
    ) ||
    (query.where &&
      (whereUsesOperator(
        query.where.where,
        EXTERNAL_OBJECT_UNSUPPORTED_OPERATORS,
      ) ||
        whereUsesToLabel(query.where.where)))
  ) {
    throw new TypeError(EXTERNAL_OBJECT_QUERY_ERROR);
  }
};

export const validateObjectQueryLimits = (query: SelectQueryNode): void => {
  const objectName = query.from.name.toLowerCase();
  const rule = REQUIRED_ROOT_FILTERS.get(objectName);

  if (
    rule &&
    (!query.where || !hasRequiredRootPredicate(query.where.where, rule.fields))
  ) {
    throw new TypeError(rule.error);
  }

  if (
    objectName === "vote" &&
    (!query.where ||
      !hasMatchingRootPredicate(query.where.where, votePredicateMatches))
  ) {
    throw new TypeError(VOTE_FILTER_ERROR);
  }

  if (objectName === "userrecordaccess") {
    validateUserRecordAccessQuery(query);
  }

  if (
    (objectName === "newsfeed" || objectName === "userprofilefeed") &&
    orderByUsesRelationship(query)
  ) {
    throw new TypeError(FEED_RELATIONSHIP_ORDER_BY_ERROR);
  }

  if (objectName.endsWith("__mdt")) {
    validateCustomMetadataQuery(query);
  }

  if (objectName.endsWith("__x")) {
    validateExternalObjectQuery(query);
  }
};
