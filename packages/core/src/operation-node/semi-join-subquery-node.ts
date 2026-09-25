import type { ReferenceNode } from "#/operation-node/reference-node";
import type { SObjectNode } from "#/operation-node/sobject-node";
import type { WhereNode } from "#/operation-node/where-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a semi-join or anti-join subquery. */
export interface SemiJoinSubqueryNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "SemiJoinSubqueryNode";
  /** Salesforce object queried by this SELECT node. */
  readonly from: SObjectNode;
  /** Selected expression represented by this node. */
  readonly selection?: ReferenceNode;
  /** Optional `WHERE` expression tree. */
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
