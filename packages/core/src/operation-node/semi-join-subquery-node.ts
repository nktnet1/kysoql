import { freeze } from "#/util/object-utils";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SObjectNode } from "#/operation-node/sobject-node";
import type { WhereNode } from "#/operation-node/where-node";

export interface SemiJoinSubqueryNode {
  readonly kind: "SemiJoinSubqueryNode";
  readonly from: SObjectNode;
  readonly selection?: ReferenceNode;
  readonly where?: WhereNode;
}

export const SemiJoinSubqueryNode = {
  createFrom(from: SObjectNode): SemiJoinSubqueryNode {
    return freeze({
      kind: "SemiJoinSubqueryNode",
      from,
    });
  },

  cloneWithSelection(
    subquery: SemiJoinSubqueryNode,
    selection: ReferenceNode,
  ): SemiJoinSubqueryNode {
    return freeze({
      ...subquery,
      selection,
    });
  },
};
