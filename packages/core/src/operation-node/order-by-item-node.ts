import { freeze } from "#/util/object-utils";
import type { ReferenceNode } from "#/operation-node/reference-node";

export type OrderByDirection = "asc" | "desc";
export type OrderByNulls = "first" | "last";

export interface OrderByItemNode {
  readonly kind: "OrderByItemNode";
  readonly orderBy: ReferenceNode;
  readonly direction?: OrderByDirection;
  readonly nulls?: OrderByNulls;
}

export const OrderByItemNode = {
  create(
    orderBy: ReferenceNode,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): OrderByItemNode {
    return freeze({
      kind: "OrderByItemNode",
      orderBy,
      ...(direction ? { direction } : {}),
      ...(nulls ? { nulls } : {}),
    });
  },
};
