import { freeze } from "../util/object-utils.js";
import type { OrderByItemNode } from "./order-by-item-node.js";
import { OrderByNode } from "./order-by-node.js";
import type { SelectionNode } from "./selection-node.js";
import type { SObjectNode } from "./sobject-node.js";
import type { WhereNode } from "./where-node.js";

export interface SelectQueryNode {
  readonly kind: "SelectQueryNode";
  readonly from: SObjectNode;
  readonly selections?: ReadonlyArray<SelectionNode>;
  readonly where?: WhereNode;
  readonly orderBy?: OrderByNode;
}

export const SelectQueryNode = {
  createFrom(from: SObjectNode): SelectQueryNode {
    return freeze({
      kind: "SelectQueryNode",
      from,
    });
  },

  cloneWithSelections(
    select: SelectQueryNode,
    selections: ReadonlyArray<SelectionNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      selections: select.selections
        ? freeze([...select.selections, ...selections])
        : freeze([...selections]),
    });
  },

  cloneWithOrderByItems(
    select: SelectQueryNode,
    items: ReadonlyArray<OrderByItemNode>,
  ): SelectQueryNode {
    return freeze({
      ...select,
      orderBy: select.orderBy
        ? OrderByNode.cloneWithItems(select.orderBy, items)
        : OrderByNode.create(items),
    });
  },
};
