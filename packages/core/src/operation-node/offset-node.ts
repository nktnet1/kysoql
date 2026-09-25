import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import { freeze } from "#/util/object-utils";

type OffsetValue = number | ApexBindExpressionNode;

/** Immutable query AST node for an OFFSET clause. */
export interface OffsetNode<Value extends OffsetValue = number> {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "OffsetNode";
  /** Optional `OFFSET` clause. */
  readonly offset: Value;
}

export const OffsetNode = {
  create<Value extends OffsetValue>(offset: Value): OffsetNode<Value> {
    return freeze({
      kind: "OffsetNode",
      offset,
    });
  },
};
