import { freeze } from "../util/object-utils.js";
import type { OperationNode } from "./operation-node.js";
import { WhereNode } from "./where-node.js";

type HasWhere = { readonly where?: WhereNode };

export const QueryNode = {
  cloneWithWhere<T extends HasWhere>(node: T, operation: OperationNode): T {
    return freeze({
      ...node,
      where: node.where
        ? WhereNode.cloneWithOperation(node.where, operation)
        : WhereNode.create(operation),
    }) as T;
  },
};
