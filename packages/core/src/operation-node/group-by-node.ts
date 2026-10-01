import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Advanced Salesforce GROUP BY modes supported by Kysoql. */
export type AdvancedGroupByMode = "rollup" | "cube";

/** Immutable query AST node for a GROUP BY clause. */
export interface GroupByNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "GroupByNode";
  /** Ordered child nodes contained by this clause. */
  readonly items: ReadonlyArray<DateFunctionNode | ReferenceNode>;
  /** Clause mode represented by this node. */
  readonly mode?: AdvancedGroupByMode;
}

export const GroupByNode = {
  create(
    items: ReadonlyArray<DateFunctionNode | ReferenceNode>,
    mode?: AdvancedGroupByMode,
  ): GroupByNode {
    if (mode !== undefined && mode !== "rollup" && mode !== "cube") {
      throw new TypeError("SOQL GROUP BY mode must be rollup or cube.");
    }

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
    items: ReadonlyArray<DateFunctionNode | ReferenceNode>,
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
