import { freeze } from "../util/object-utils.js";
import type { OrderByItemNode } from "./order-by-item-node.js";

export interface OrderByNode {
  readonly kind: "OrderByNode";
  readonly items: ReadonlyArray<OrderByItemNode>;
}

export const OrderByNode = {
  create(items: ReadonlyArray<OrderByItemNode>): OrderByNode {
    return freeze({
      kind: "OrderByNode",
      items: freeze([...items]),
    });
  },

  cloneWithItems(
    orderBy: OrderByNode,
    items: ReadonlyArray<OrderByItemNode>,
  ): OrderByNode {
    return freeze({
      ...orderBy,
      items: freeze([...orderBy.items, ...items]),
    });
  },
};
