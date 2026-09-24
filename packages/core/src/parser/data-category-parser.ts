import type { AndNode } from "#/operation-node/and-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import {
  DataCategorySelectionNode,
  type DataCategorySelector,
  type WithDataCategoryNode,
} from "#/operation-node/with-data-category-node";

export type { DataCategorySelector } from "#/operation-node/with-data-category-node";

export type DataCategoryInput<Category extends string> =
  | Category
  | readonly [Category, ...Category[]];

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const SELECTORS = new Set<DataCategorySelector>([
  "at",
  "above",
  "below",
  "above_or_below",
]);

const validateIdentifier = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(
      `SOQL WITH DATA CATEGORY ${label} must be a Salesforce API name.`,
    );
  }

  return value;
};

const validateSelector = (selector: unknown): DataCategorySelector => {
  if (!SELECTORS.has(selector as DataCategorySelector)) {
    throw new TypeError(
      "SOQL WITH DATA CATEGORY selector must be at, above, below, or above_or_below.",
    );
  }

  return selector as DataCategorySelector;
};

const validateCategories = (
  categories: readonly unknown[],
): readonly string[] => {
  if (categories.length === 0) {
    throw new TypeError(
      "SOQL WITH DATA CATEGORY requires at least one category name.",
    );
  }

  return categories.map((category) => validateIdentifier(category, "category"));
};

export const parseDataCategorySelection = (
  group: string,
  selector: DataCategorySelector,
  categoryOrCategories: string | readonly string[],
): DataCategorySelectionNode => {
  const categories = Array.isArray(categoryOrCategories)
    ? categoryOrCategories
    : [categoryOrCategories];

  return DataCategorySelectionNode.create(
    validateIdentifier(group, "group"),
    validateSelector(selector),
    validateCategories(categories),
  );
};

export const validateWithDataCategory = (node: WithDataCategoryNode): void => {
  if (node.selections.length === 0 || node.selections.length > 3) {
    throw new TypeError(
      "SOQL WITH DATA CATEGORY supports between one and three conditions.",
    );
  }

  const groups = new Set<string>();
  for (const selection of node.selections) {
    const group = validateIdentifier(selection.group, "group");
    validateSelector(selection.selector);
    validateCategories(selection.categories);

    if (groups.has(group)) {
      throw new TypeError(
        `SOQL WITH DATA CATEGORY cannot use the same category group more than once: ${group}.`,
      );
    }
    groups.add(group);
  }
};

const isKnowledgeArticleObject = (objectName: string): boolean => {
  const normalized = objectName.toLowerCase();

  return (
    normalized === "knowledgearticleversion" || normalized.endsWith("__kav")
  );
};

const supportsDataCategory = (objectName: string): boolean =>
  objectName.toLowerCase() === "question" ||
  isKnowledgeArticleObject(objectName);

const isKnowledgeArticleRequiredReference = (node: OperationNode): boolean => {
  if (node.kind !== "ReferenceNode") {
    return false;
  }

  const name = (node as ReferenceNode).name.toLowerCase();

  return name === "id" || name === "publishstatus";
};

const hasKnowledgeArticleRequiredPredicate = (node: OperationNode): boolean => {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return (
        hasKnowledgeArticleRequiredPredicate(and.left) ||
        hasKnowledgeArticleRequiredPredicate(and.right)
      );
    }
    case "BinaryOperationNode":
      return isKnowledgeArticleRequiredReference(
        (node as BinaryOperationNode).leftOperand,
      );
    case "NotNode":
      return hasKnowledgeArticleRequiredPredicate((node as NotNode).operand);
    case "OrNode": {
      const or = node as OrNode;
      return (
        hasKnowledgeArticleRequiredPredicate(or.left) ||
        hasKnowledgeArticleRequiredPredicate(or.right)
      );
    }
    default:
      return false;
  }
};

export const validateDataCategoryQuery = (query: SelectQueryNode): void => {
  if (!query.withDataCategory) {
    return;
  }

  validateWithDataCategory(query.withDataCategory);

  if (!supportsDataCategory(query.from.name)) {
    throw new TypeError(
      "SOQL WITH DATA CATEGORY is only supported for Question, KnowledgeArticleVersion, or a specific Knowledge article type (__kav).",
    );
  }

  if (
    isKnowledgeArticleObject(query.from.name) &&
    (!query.where || !hasKnowledgeArticleRequiredPredicate(query.where.where))
  ) {
    throw new TypeError(
      "SOQL WITH DATA CATEGORY queries on Knowledge articles require a WHERE predicate on PublishStatus or Id.",
    );
  }
};
