import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { DistanceFunctionNode } from "#/operation-node/distance-function-node";
import type { RawNode } from "#/operation-node/raw-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type OrderByDirection = "asc" | "desc";
export type OrderByNulls = "first" | "last";

export interface OrderByItemNode {
  readonly kind: "OrderByItemNode";
  readonly orderBy:
    | AggregateFunctionNode
    | DateFunctionNode
    | DistanceFunctionNode
    | RawNode
    | ReferenceNode;
  readonly direction?: OrderByDirection;
  readonly nulls?: OrderByNulls;
}

export const OrderByItemNode = {
  create(
    orderBy:
      | AggregateFunctionNode
      | DateFunctionNode
      | DistanceFunctionNode
      | RawNode
      | ReferenceNode,
    direction?: OrderByDirection,
    nulls?: OrderByNulls,
  ): OrderByItemNode {
    if (
      direction !== undefined &&
      direction !== "asc" &&
      direction !== "desc"
    ) {
      throw new TypeError("SOQL ORDER BY direction must be asc or desc.");
    }

    if (nulls !== undefined && nulls !== "first" && nulls !== "last") {
      throw new TypeError(
        "SOQL ORDER BY null placement must be first or last.",
      );
    }

    return freeze({
      kind: "OrderByItemNode",
      orderBy,
      ...(direction ? { direction } : {}),
      ...(nulls ? { nulls } : {}),
    });
  },
};
