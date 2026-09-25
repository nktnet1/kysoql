import { AndNode } from "#/operation-node/and-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a WHERE clause. */
export interface WhereNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "WhereNode";
  /** Optional `WHERE` expression tree. */
  readonly where: OperationNode;
}

export const WhereNode = {
  create(filter: OperationNode): WhereNode {
    return freeze({
      kind: "WhereNode",
      where: filter,
    });
  },

  cloneWithOperation(
    whereNode: WhereNode,
    operation: OperationNode,
  ): WhereNode {
    return freeze({
      ...whereNode,
      where: AndNode.create(whereNode.where, operation),
    });
  },
};
