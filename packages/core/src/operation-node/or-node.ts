import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for logical OR. */
export interface OrNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "OrNode";
  /** Left boolean expression. */
  readonly left: OperationNode;
  /** Right boolean expression. */
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
