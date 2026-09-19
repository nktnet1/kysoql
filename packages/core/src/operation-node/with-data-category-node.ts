import { freeze } from "#/util/object-utils";

export type DataCategorySelector =
  | "at"
  | "above"
  | "below"
  | "above_or_below";

export interface DataCategorySelectionNode {
  readonly kind: "DataCategorySelectionNode";
  readonly group: string;
  readonly selector: DataCategorySelector;
  readonly categories: readonly string[];
}

export interface WithDataCategoryNode {
  readonly kind: "WithDataCategoryNode";
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
