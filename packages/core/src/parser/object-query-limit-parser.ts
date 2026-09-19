import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";

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

const isRequiredRootReference = (
  node: OperationNode,
  fields: ReadonlySet<string>,
): boolean =>
  node.kind === "ReferenceNode" &&
  fields.has((node as ReferenceNode).name.toLowerCase());

const hasRequiredRootPredicate = (
  node: OperationNode,
  fields: ReadonlySet<string>,
): boolean => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return (
        hasRequiredRootPredicate(and.left, fields) ||
        hasRequiredRootPredicate(and.right, fields)
      );
    }
    case "BinaryOperationNode":
      return isRequiredRootReference(
        (node as BinaryOperationNode).leftOperand,
        fields,
      );
    case "NotNode":
      return hasRequiredRootPredicate((node as NotNode).operand, fields);
    case "OrNode": {
      const or = node as OrNode;
      return (
        hasRequiredRootPredicate(or.left, fields) ||
        hasRequiredRootPredicate(or.right, fields)
      );
    }
    default:
      return false;
  }
};

export const validateObjectQueryLimits = (query: SelectQueryNode): void => {
  const rule = REQUIRED_ROOT_FILTERS.get(query.from.name.toLowerCase());

  if (
    rule &&
    (!query.where || !hasRequiredRootPredicate(query.where.where, rule.fields))
  ) {
    throw new TypeError(rule.error);
  }
};
