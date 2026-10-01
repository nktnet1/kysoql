import { freeze } from "#src/util/object-utils";

/** Selectors accepted by Salesforce WITH DATA CATEGORY. */
export type DataCategorySelector = "at" | "above" | "below" | "above_or_below";

/** Immutable query AST node for one WITH DATA CATEGORY selection. */
export interface DataCategorySelectionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "DataCategorySelectionNode";
  /** Data-category group API name. */
  readonly group: string;
  /** Salesforce `FIELDS()` selector. */
  readonly selector: DataCategorySelector;
  /** Data-category values matched by this selection. */
  readonly categories: readonly string[];
}

/** Immutable query AST node for a WITH DATA CATEGORY clause. */
export interface WithDataCategoryNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "WithDataCategoryNode";
  /** Selections emitted by this query or subquery. */
  readonly selections: readonly DataCategorySelectionNode[];
}

const MAX_DATA_CATEGORY_CONDITIONS = 3;

export const DataCategorySelectionNode = {
  create(
    group: string,
    selector: DataCategorySelector,
    categories: readonly string[],
  ): DataCategorySelectionNode {
    return freeze({
      kind: "DataCategorySelectionNode",
      group,
      selector,
      categories: freeze([...categories]),
    });
  },
};

export const WithDataCategoryNode = {
  create(selection: DataCategorySelectionNode): WithDataCategoryNode {
    return freeze({
      kind: "WithDataCategoryNode",
      selections: freeze([selection]),
    });
  },

  cloneWithSelection(
    node: WithDataCategoryNode,
    selection: DataCategorySelectionNode,
  ): WithDataCategoryNode {
    if (node.selections.length >= MAX_DATA_CATEGORY_CONDITIONS) {
      throw new TypeError(
        "SOQL WITH DATA CATEGORY supports at most three conditions.",
      );
    }

    if (node.selections.some((item) => item.group === selection.group)) {
      throw new TypeError(
        `SOQL WITH DATA CATEGORY cannot use the same category group more than once: ${selection.group}.`,
      );
    }

    return freeze({
      kind: "WithDataCategoryNode",
      selections: freeze([...node.selections, selection]),
    });
  },
};
