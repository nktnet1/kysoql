import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

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
