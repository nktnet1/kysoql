import { freeze } from "#/util/object-utils";

/** Salesforce FOR VIEW and FOR REFERENCE query modes. */
export type ForViewReferenceMode = "view" | "reference";

/** Immutable query AST node for a FOR VIEW or FOR REFERENCE clause. */
export interface ForViewReferenceNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ForViewReferenceNode";
  /** Clause mode represented by this node. */
  readonly mode: ForViewReferenceMode;
}

export const ForViewReferenceNode = {
  create(mode: ForViewReferenceMode): ForViewReferenceNode {
    if (mode !== "view" && mode !== "reference") {
      throw new TypeError("SOQL FOR mode must be view or reference.");
    }

    return freeze({
      kind: "ForViewReferenceNode",
      mode,
    });
  },
};
