import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a binary filter comparison. */
export interface BinaryOperationNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "BinaryOperationNode";
  /** Left operand of the operation. */
  readonly leftOperand: OperationNode;
  /** SOQL comparison or arithmetic operator. */
  readonly operator: OperationNode;
  /** Right operand of the operation. */
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
