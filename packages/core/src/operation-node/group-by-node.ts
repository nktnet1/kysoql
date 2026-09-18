import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type AdvancedGroupByMode = "rollup" | "cube";

export interface GroupByNode {
  readonly kind: "GroupByNode";
  readonly items: ReadonlyArray<ReferenceNode>;
  readonly mode?: AdvancedGroupByMode;
}

export const GroupByNode = {
  create(
    items: ReadonlyArray<ReferenceNode>,
    mode?: AdvancedGroupByMode,
  ): GroupByNode {
    return freeze(
      mode
        ? {
            kind: "GroupByNode",
            items: freeze([...items]),
            mode,
          }
        : {
            kind: "GroupByNode",
            items: freeze([...items]),
          },
    );
  },

  cloneWithItems(
    groupBy: GroupByNode,
    items: ReadonlyArray<ReferenceNode>,
    mode?: AdvancedGroupByMode,
  ): GroupByNode {
    if (groupBy.mode !== mode) {
      throw new TypeError(
        "SOQL GROUP BY, GROUP BY ROLLUP, and GROUP BY CUBE forms cannot be mixed.",
      );
    }

    return freeze({
      ...groupBy,
      items: freeze([...groupBy.items, ...items]),
    });
  },
};
