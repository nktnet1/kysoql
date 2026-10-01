import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for the FOR UPDATE clause. */
export interface ForUpdateNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ForUpdateNode";
}

export const ForUpdateNode = {
  create(): ForUpdateNode {
    return freeze({
      kind: "ForUpdateNode",
    });
  },
};
