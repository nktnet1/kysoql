import { ValueNode } from "#/operation-node/value-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a list of bound SOQL values. */
export interface ValueListNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ValueListNode";
  /** Values contained in this list expression. */
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
