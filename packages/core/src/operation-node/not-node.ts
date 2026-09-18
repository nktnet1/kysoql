import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

export interface NotNode {
  readonly kind: "NotNode";
  readonly operand: OperationNode;
}

export const NotNode = {
  create(operand: OperationNode): NotNode {
    return freeze({
      kind: "NotNode",
      operand,
    });
  },
};
