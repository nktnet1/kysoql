import { freeze } from "#/util/object-utils";

export type ForViewReferenceMode = "view" | "reference";

export interface ForViewReferenceNode {
  readonly kind: "ForViewReferenceNode";
  readonly mode: ForViewReferenceMode;
}

export const ForViewReferenceNode = {
  create(mode: ForViewReferenceMode): ForViewReferenceNode {
    return freeze({
      kind: "ForViewReferenceNode",
      mode,
    });
  },
};
