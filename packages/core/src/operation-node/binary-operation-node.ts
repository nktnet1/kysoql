import { freeze } from "#/util/object-utils";
import type { OperationNode } from "#/operation-node/operation-node";

export interface BinaryOperationNode {
  readonly kind: "BinaryOperationNode";
  readonly leftOperand: OperationNode;
  readonly operator: OperationNode;
  readonly rightOperand: OperationNode;
}

export const BinaryOperationNode = {
  create(
    leftOperand: OperationNode,
    operator: OperationNode,
    rightOperand: OperationNode,
  ): BinaryOperationNode {
    return freeze({
      kind: "BinaryOperationNode",
      leftOperand,
      operator,
      rightOperand,
    });
  },
};
