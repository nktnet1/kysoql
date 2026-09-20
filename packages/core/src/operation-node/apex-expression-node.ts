import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import type { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import { freeze } from "#/util/object-utils";

export type ApexExpressionOperandNode =
  | ApexBindNode
  | ApexAdditionNode
  | ApexSubstringNode
  | ApexLiteralNode;

export interface ApexAdditionNode {
  readonly kind: "ApexAdditionNode";
  readonly leftOperand: ApexExpressionOperandNode;
  readonly rightOperand: ApexExpressionOperandNode;
}

export interface ApexSubstringNode {
  readonly kind: "ApexSubstringNode";
  readonly source: ApexExpressionOperandNode;
  readonly beginIndex: number;
  readonly endIndex: number;
}

export type ApexBindExpressionNode =
  | ApexBindNode
  | ApexAdditionNode
  | ApexSubstringNode;

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

export const ApexSubstringNode = {
  create(
    source: ApexExpressionOperandNode,
    beginIndex: number,
    endIndex: number,
  ): ApexSubstringNode {
    return freeze({
      kind: "ApexSubstringNode",
      source,
      beginIndex,
      endIndex,
    });
  },
};
