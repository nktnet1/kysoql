import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import type { ApexLiteralNode } from "#/operation-node/apex-literal-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for an Apex expression operand. */
export type ApexExpressionOperandNode =
  | ApexBindNode
  | ApexAdditionNode
  | ApexQueryResultNode
  | ApexSubstringNode
  | ApexLiteralNode;

/** Immutable query AST node for an Apex addition expression. */
export interface ApexAdditionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexAdditionNode";
  /** Left operand of the operation. */
  readonly leftOperand: ApexExpressionOperandNode;
  /** Right operand of the operation. */
  readonly rightOperand: ApexExpressionOperandNode;
}

/** Immutable query AST node for a field read from an Apex query result. */
export interface ApexQueryResultNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexQueryResultNode";
  /** Operation tree associated with this API value. */
  readonly query: SelectQueryNode;
  /** Field reference selected from the query result. */
  readonly field: string;
  /** Expected cardinality of the Apex query-result access. */
  readonly cardinality: "single";
}

/** Immutable query AST node for an Apex substring expression. */
export interface ApexSubstringNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexSubstringNode";
  /** Source string or expression passed to `substring`. */
  readonly source: ApexExpressionOperandNode;
  /** Zero-based Apex substring start index. */
  readonly beginIndex: number;
  /** Optional Apex substring end index. */
  readonly endIndex: number;
}

/** Immutable query AST node for a supported Apex bind expression. */
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
