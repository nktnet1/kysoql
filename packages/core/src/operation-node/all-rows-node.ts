import { freeze } from "#/util/object-utils";

/** Immutable query AST node for the ALL ROWS modifier. */
export interface AllRowsNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "AllRowsNode";
}

export const AllRowsNode = {
  create(): AllRowsNode {
    return freeze({
      kind: "AllRowsNode",
    });
  },
};
