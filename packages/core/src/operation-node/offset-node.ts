import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import { freeze } from "#/util/object-utils";

type OffsetValue = number | ApexBindExpressionNode;

export interface OffsetNode<Value extends OffsetValue = number> {
  readonly kind: "OffsetNode";
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
