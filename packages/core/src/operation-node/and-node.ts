import { freeze } from "#/util/object-utils";
import type { OperationNode } from "#/operation-node/operation-node";

export interface AndNode {
  readonly kind: "AndNode";
  readonly left: OperationNode;
  readonly right: OperationNode;
}

export const AndNode = {
  create(left: OperationNode, right: OperationNode): AndNode {
    return freeze({
      kind: "AndNode",
      left,
      right,
    });
  },
};
