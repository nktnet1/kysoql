import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for logical AND. */
export interface AndNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "AndNode";
  /** Left boolean expression. */
  readonly left: OperationNode;
  /** Right boolean expression. */
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
