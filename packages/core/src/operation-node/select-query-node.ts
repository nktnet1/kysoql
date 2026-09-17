import { freeze } from "../util/object-utils.js";
import type { SelectionNode } from "./selection-node.js";
import type { SObjectNode } from "./sobject-node.js";
import type { WhereNode } from "./where-node.js";

export interface SelectQueryNode {
  readonly kind: "SelectQueryNode";
  readonly from: SObjectNode;
  readonly selections?: ReadonlyArray<SelectionNode>;
  readonly where?: WhereNode;
}

export const SelectQueryNode = {
  createFrom(from: SObjectNode): SelectQueryNode {
    return freeze({
      kind: "SelectQueryNode",
      from,
    });
  },

  cloneWithSelections(
    select: SelectQueryNode,
    selections: ReadonlyArray<SelectionNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      selections: select.selections
        ? freeze([...select.selections, ...selections])
        : freeze([...selections]),
    });
  },
};
