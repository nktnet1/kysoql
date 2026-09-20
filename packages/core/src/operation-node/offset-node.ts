import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import { freeze } from "#/util/object-utils";

type OffsetValue = number | ApexBindNode;

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
