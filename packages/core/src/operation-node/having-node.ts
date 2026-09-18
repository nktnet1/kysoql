import { AndNode } from "#/operation-node/and-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

export interface HavingNode {
  readonly kind: "HavingNode";
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
