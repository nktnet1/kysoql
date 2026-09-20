import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import type { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import { freeze } from "#/util/object-utils";

export type ApexExpressionOperandNode =
  | ApexBindNode
  | ApexAdditionNode
  | ApexLiteralNode;

export interface ApexAdditionNode {
  readonly kind: "ApexAdditionNode";
  readonly leftOperand: ApexExpressionOperandNode;
  readonly rightOperand: ApexExpressionOperandNode;
}

export type ApexBindExpressionNode = ApexBindNode | ApexAdditionNode;

export const ApexAdditionNode = {
  create(
    leftOperand: ApexExpressionOperandNode,
    rightOperand: ApexExpressionOperandNode,
  ): ApexAdditionNode {
    return freeze({
      kind: "ApexAdditionNode",
      leftOperand,
      rightOperand,
    });
  },
};
