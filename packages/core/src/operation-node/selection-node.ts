import { freeze } from "../util/object-utils.js";
import type { ReferenceNode } from "./reference-node.js";

export interface SelectionNode {
  readonly kind: "SelectionNode";
  readonly selection: ReferenceNode;
}

export const SelectionNode = {
  create(selection: ReferenceNode): SelectionNode {
    return freeze({
      kind: "SelectionNode",
      selection,
    });
  },
};
