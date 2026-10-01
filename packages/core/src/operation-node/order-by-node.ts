import type { OrderByItemNode } from "#/operation-node/order-by-item-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for an ORDER BY clause. */
export interface OrderByNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "OrderByNode";
  /** Ordered child nodes contained by this clause. */
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
