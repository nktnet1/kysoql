import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import { freeze } from "#/util/object-utils";

export interface SelectionNode {
  readonly kind: "SelectionNode";
  readonly selection:
    | AggregateFunctionNode
    | AliasNode
    | ReferenceNode
    | RelationshipSubqueryNode;
}

export const SelectionNode = {
  create(
    selection:
      | AggregateFunctionNode
      | AliasNode
      | ReferenceNode
      | RelationshipSubqueryNode,
  ): SelectionNode {
    return freeze({
      kind: "SelectionNode",
      selection,
    });
  },
};
