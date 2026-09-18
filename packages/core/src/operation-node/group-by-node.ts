import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface GroupByNode {
  readonly kind: "GroupByNode";
  readonly items: ReadonlyArray<ReferenceNode>;
}

export const GroupByNode = {
  create(items: ReadonlyArray<ReferenceNode>): GroupByNode {
    return freeze({
      kind: "GroupByNode",
      items: freeze([...items]),
    });
  },

  cloneWithItems(
    groupBy: GroupByNode,
    items: ReadonlyArray<ReferenceNode>,
  ): GroupByNode {
    return freeze({
      ...groupBy,
      items: freeze([...groupBy.items, ...items]),
    });
  },
};
