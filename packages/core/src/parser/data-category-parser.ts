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

  return categories.map((category) =>
    validateIdentifier(category, "category"),
  );
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
