import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Salesforce aggregate function names represented in the query AST. */
export type AggregateFunction =
  | "avg"
  | "count"
  | "countDistinct"
  | "max"
  | "min"
  | "sum"
  | "grouping";

/** Immutable query AST node for a Salesforce aggregate function. */
export interface AggregateFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "AggregateFunctionNode";
  /** Salesforce function represented by this node. */
  readonly function: AggregateFunction;
  /** Field or relationship reference passed to the expression. */
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
