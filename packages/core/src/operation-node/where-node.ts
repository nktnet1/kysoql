import { freeze } from "../util/object-utils.js";
import { AndNode } from "./and-node.js";
import type { OperationNode } from "./operation-node.js";

export interface WhereNode {
  readonly kind: "WhereNode";
  readonly where: OperationNode;
}

export const WhereNode = {
  create(filter: OperationNode): WhereNode {
    return freeze({
      kind: "WhereNode",
      where: filter,
    });
  },

  cloneWithOperation(whereNode: WhereNode, operation: OperationNode): WhereNode {
    return freeze({
      ...whereNode,
      where: AndNode.create(whereNode.where, operation),
    });
  },
};
