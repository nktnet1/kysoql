import { freeze } from "#/util/object-utils";

export interface ForUpdateNode {
  readonly kind: "ForUpdateNode";
}

export const ForUpdateNode = {
  create(): ForUpdateNode {
    return freeze({
      kind: "ForUpdateNode",
    });
  },
};
