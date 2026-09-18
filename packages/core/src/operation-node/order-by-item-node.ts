import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type OrderByDirection = "asc" | "desc";
export type OrderByNulls = "first" | "last";

export interface OrderByItemNode {
  readonly kind: "OrderByItemNode";
  readonly orderBy: AggregateFunctionNode | ReferenceNode;
  readonly direction?: OrderByDirection;
  readonly nulls?: OrderByNulls;
}

export const OrderByItemNode = {
  create(
    orderBy: AggregateFunctionNode | ReferenceNode,
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
