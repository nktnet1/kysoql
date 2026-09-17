import { freeze } from "#/util/object-utils";
import type { ReferenceNode } from "#/operation-node/reference-node";

export type OrderByDirection = "asc" | "desc";

export interface OrderByItemNode {
  readonly kind: "OrderByItemNode";
  readonly orderBy: ReferenceNode;
  readonly direction?: OrderByDirection;
}

export const OrderByItemNode = {
  create(
    orderBy: ReferenceNode,
    direction?: OrderByDirection,
  ): OrderByItemNode {
    return freeze(
      direction
        ? {
            kind: "OrderByItemNode",
            orderBy,
            direction,
          }
        : {
            kind: "OrderByItemNode",
            orderBy,
          },
    );
  },
};
