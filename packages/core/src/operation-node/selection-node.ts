import { freeze } from "#/util/object-utils";
import type { ReferenceNode } from "#/operation-node/reference-node";

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
