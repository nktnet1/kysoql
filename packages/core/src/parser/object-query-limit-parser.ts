import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
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

const nonEmptyStringValueList = (node: OperationNode): boolean =>
  node.kind === "ValueListNode" &&
  (node as ValueListNode).values.length > 0 &&
  (node as ValueListNode).values.every((value) => nonEmptyStringValue(value));

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
};
