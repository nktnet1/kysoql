import { freeze } from "#/util/object-utils";
import type { OperationNode } from "#/operation-node/operation-node";

export interface OrNode {
  readonly kind: "OrNode";
  readonly left: OperationNode;
  readonly right: OperationNode;
}

export const OrNode = {
  create(left: OperationNode, right: OperationNode): OrNode {
    return freeze({
      kind: "OrNode",
      left,
      right,
    });
  },
};
