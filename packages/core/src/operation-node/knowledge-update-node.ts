import { freeze } from "#/util/object-utils";

export type KnowledgeUpdateMode = "tracking" | "viewstat";

export interface KnowledgeUpdateNode {
  readonly kind: "KnowledgeUpdateNode";
  readonly modes: ReadonlyArray<KnowledgeUpdateMode>;
}

const ALL_MODES = ["tracking", "viewstat"] as const;

export const KnowledgeUpdateNode = {
  create(mode: KnowledgeUpdateMode): KnowledgeUpdateNode {
    return freeze({
      kind: "KnowledgeUpdateNode",
      modes: freeze([mode]),
    });
  },

  cloneWithMode(
    node: KnowledgeUpdateNode,
    mode: KnowledgeUpdateMode,
  ): KnowledgeUpdateNode {
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
