import type { OperationNode } from "#src/operation-node/operation-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for logical NOT. */
export interface NotNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "NotNode";
  /** Expression operand being negated. */
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
