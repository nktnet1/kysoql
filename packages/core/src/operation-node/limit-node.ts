import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import { freeze } from "#/util/object-utils";

type LimitValue = number | ApexBindNode;

export interface LimitNode<Value extends LimitValue = number> {
  readonly kind: "LimitNode";
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
