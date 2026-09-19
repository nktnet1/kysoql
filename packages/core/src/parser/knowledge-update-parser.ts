import type { SelectQueryNode } from "#/operation-node/select-query-node";

export type KnowledgeArticleUpdateCheck<ObjectName> = [
  Exclude<ObjectName, "KnowledgeArticleVersion" | `${string}__kav`>,
] extends [never]
  ? readonly []
  : readonly [knowledgeArticleOnly: never];

const isKnowledgeArticleObjectName = (objectName: string): boolean =>
  objectName === "KnowledgeArticleVersion" || objectName.endsWith("__kav");

export const validateKnowledgeUpdateQuery = (
  query: SelectQueryNode,
): void => {
  if (
    query.knowledgeUpdate &&
    !isKnowledgeArticleObjectName(query.from.name)
  ) {
    throw new Error(
      "UPDATE TRACKING and UPDATE VIEWSTAT can only be used with Salesforce Knowledge article queries.",
    );
  }
};
