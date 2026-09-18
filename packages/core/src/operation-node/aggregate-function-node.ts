import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type AggregateFunction =
  | "avg"
  | "count"
  | "countDistinct"
  | "max"
  | "min"
  | "sum";

export interface AggregateFunctionNode {
  readonly kind: "AggregateFunctionNode";
  readonly function: AggregateFunction;
  readonly reference?: ReferenceNode;
}

export const AggregateFunctionNode = {
  create(
    aggregateFunction: AggregateFunction,
    reference?: ReferenceNode,
  ): AggregateFunctionNode {
    return freeze({
      kind: "AggregateFunctionNode",
      function: aggregateFunction,
      ...(reference === undefined ? {} : { reference }),
    });
  },
};
