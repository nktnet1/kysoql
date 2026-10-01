import type { OperationNode } from "#src/operation-node/operation-node";
import { parseSelectionAlias } from "#src/parser/selection-alias-parser";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a SELECT alias. */
export interface AliasNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "AliasNode";
  /** Operation node wrapped by this node. */
  readonly node: OperationNode;
  /** Selection alias emitted for the wrapped expression. */
  readonly alias: string;
}

export const AliasNode = {
  create(node: OperationNode, alias: string): AliasNode {
    return freeze({
      kind: "AliasNode",
      node,
      alias: parseSelectionAlias(alias),
    });
  },
};
