import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import type { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import { freeze } from "#/util/object-utils";

export type ApexExpressionOperandNode =
  | ApexBindNode
  | ApexAdditionNode
  | ApexQueryResultNode
  | ApexSubstringNode
  | ApexLiteralNode;

export interface ApexAdditionNode {
  readonly kind: "ApexAdditionNode";
  readonly leftOperand: ApexExpressionOperandNode;
  readonly rightOperand: ApexExpressionOperandNode;
}

export interface ApexQueryResultNode {
  readonly kind: "ApexQueryResultNode";
  readonly query: SelectQueryNode;
  readonly field: string;
  readonly cardinality: "single";
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
  | ApexQueryResultNode
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

export const ApexQueryResultNode = {
  create(query: SelectQueryNode, field: string): ApexQueryResultNode {
    return freeze({
      kind: "ApexQueryResultNode",
      query,
      field,
      cardinality: "single",
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
