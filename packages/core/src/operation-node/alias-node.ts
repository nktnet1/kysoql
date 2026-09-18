import type { OperationNode } from "#/operation-node/operation-node";
import { freeze } from "#/util/object-utils";

export interface AliasNode {
  readonly kind: "AliasNode";
  readonly node: OperationNode;
  readonly alias: string;
}

export const AliasNode = {
  create(node: OperationNode, alias: string): AliasNode {
    return freeze({
      kind: "AliasNode",
      node,
      alias,
    });
  },
};
