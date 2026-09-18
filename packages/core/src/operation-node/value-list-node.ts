import { ValueNode } from "#/operation-node/value-node";
import { freeze } from "#/util/object-utils";

export interface ValueListNode {
  readonly kind: "ValueListNode";
  readonly values: readonly ValueNode[];
}

export const ValueListNode = {
  create(values: readonly unknown[]): ValueListNode {
    return freeze({
      kind: "ValueListNode",
      values: freeze(values.map((value) => ValueNode.create(value))),
    });
  },
};
