import { freeze } from "#/util/object-utils";

export type KnowledgeUpdateMode = "tracking" | "viewstat";

export interface KnowledgeUpdateNode {
  readonly kind: "KnowledgeUpdateNode";
  readonly modes: ReadonlyArray<KnowledgeUpdateMode>;
}

const ALL_MODES = ["tracking", "viewstat"] as const;

export const KnowledgeUpdateNode = {
  create(mode: KnowledgeUpdateMode): KnowledgeUpdateNode {
    if (!ALL_MODES.includes(mode)) {
      throw new TypeError("SOQL UPDATE mode must be tracking or viewstat.");
    }

    return freeze({
      kind: "KnowledgeUpdateNode",
      modes: freeze([mode]),
    });
  },

  cloneWithMode(
    node: KnowledgeUpdateNode,
    mode: KnowledgeUpdateMode,
  ): KnowledgeUpdateNode {
    if (!ALL_MODES.includes(mode)) {
      throw new TypeError("SOQL UPDATE mode must be tracking or viewstat.");
    }

    return freeze({
      kind: "KnowledgeUpdateNode",
      modes: freeze(
        ALL_MODES.filter(
          (candidate) => candidate === mode || node.modes.includes(candidate),
        ),
      ),
    });
  },
};
