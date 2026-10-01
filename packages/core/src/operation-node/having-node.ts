import { AndNode } from "#/operation-node/and-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a HAVING clause. */
export interface HavingNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "HavingNode";
  /** Optional `HAVING` clause. */
  readonly having: OperationNode;
}

export const HavingNode = {
  create(operation: OperationNode): HavingNode {
    return freeze({
      kind: "HavingNode",
      having: operation,
    });
  },

  cloneWithOperation(
    havingNode: HavingNode,
    operation: OperationNode,
  ): HavingNode {
    return freeze({
      ...havingNode,
      having: AndNode.create(havingNode.having, operation),
    });
  },
};
