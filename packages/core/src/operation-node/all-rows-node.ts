import { freeze } from "#/util/object-utils";

export interface AllRowsNode {
  readonly kind: "AllRowsNode";
}

export const AllRowsNode = {
  create(): AllRowsNode {
    return freeze({
      kind: "AllRowsNode",
    });
  },
};
