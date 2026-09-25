import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import { freeze } from "#/util/object-utils";

type LimitValue = number | ApexBindExpressionNode;

/** Immutable query AST node for a LIMIT clause. */
export interface LimitNode<Value extends LimitValue = number> {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "LimitNode";
  /** Optional `LIMIT` clause. */
  readonly limit: Value;
}

export const LimitNode = {
  create<Value extends LimitValue>(limit: Value): LimitNode<Value> {
    return freeze({
      kind: "LimitNode",
      limit,
    });
  },
};
