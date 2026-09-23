import { freeze } from "#/util/object-utils";

export type ForViewReferenceMode = "view" | "reference";

export interface ForViewReferenceNode {
  readonly kind: "ForViewReferenceNode";
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
