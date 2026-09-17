import { freeze } from "../util/object-utils.js";
import type { ReferenceNode } from "./reference-node.js";

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
