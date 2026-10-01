import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { DateFunctionNode } from "#src/operation-node/date-function-node";
import type { DistanceFunctionNode } from "#src/operation-node/distance-function-node";
import type { RawNode } from "#src/operation-node/raw-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import { freeze } from "#src/util/object-utils";

/** Sort directions accepted by SOQL ORDER BY. */
export type OrderByDirection = "asc" | "desc";
/** NULLS FIRST and NULLS LAST modifiers accepted by SOQL ORDER BY. */
export type OrderByNulls = "first" | "last";

/** Immutable query AST node for one ORDER BY item. */
export interface OrderByItemNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "OrderByItemNode";
  /** Expression being sorted. */
  readonly orderBy:
    | AggregateFunctionNode
    | DateFunctionNode
    | DistanceFunctionNode
    | RawNode
    | ReferenceNode;
  /** Sort direction, when explicitly specified. */
  readonly direction?: OrderByDirection;
  /** Explicit Salesforce null ordering, when specified. */
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
