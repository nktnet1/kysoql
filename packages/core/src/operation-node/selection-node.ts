import { freeze } from "#/util/object-utils";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";

export interface SelectionNode {
  readonly kind: "SelectionNode";
  readonly selection: ReferenceNode | RelationshipSubqueryNode;
}

export const SelectionNode = {
  create(selection: ReferenceNode | RelationshipSubqueryNode): SelectionNode {
    return freeze({
      kind: "SelectionNode",
      selection,
    });
  },
};
