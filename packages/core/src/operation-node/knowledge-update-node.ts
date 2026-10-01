import { freeze } from "#/util/object-utils";

/** Salesforce Knowledge UPDATE TRACKING and UPDATE VIEWSTAT modes. */
export type KnowledgeUpdateMode = "tracking" | "viewstat";

/** Immutable query AST node for a Salesforce Knowledge UPDATE clause. */
export interface KnowledgeUpdateNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "KnowledgeUpdateNode";
  /** KnowledgeArticle update modes emitted by the query. */
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
