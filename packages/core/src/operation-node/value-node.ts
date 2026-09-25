import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a bound SOQL value. */
export interface ValueNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ValueNode";
  /** Literal value represented by this node. */
  readonly value: unknown;
}

export const ValueNode = {
  create(value: unknown): ValueNode {
    return freeze({
      kind: "ValueNode",
      value,
    });
  },
};
