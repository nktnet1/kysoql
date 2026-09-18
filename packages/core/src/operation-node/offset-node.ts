import { freeze } from "#/util/object-utils";

export interface OffsetNode {
  readonly kind: "OffsetNode";
  readonly offset: number;
}

export const OffsetNode = {
  create(offset: number): OffsetNode {
    return freeze({
      kind: "OffsetNode",
      offset,
    });
  },
};
