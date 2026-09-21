import type { OperationNode } from "#/operation-node/operation-node";
import { WhereNode } from "#/operation-node/where-node";
import { freeze } from "#/util/object-utils";

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

  cloneWithoutWhere<T extends HasWhere>(node: T): T {
    const { where: _where, ...withoutWhere } = node;

    return freeze(withoutWhere) as T;
  },
};
