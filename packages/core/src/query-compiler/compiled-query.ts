import type { SelectQueryNode } from "#/operation-node/select-query-node";

/** Type-only carrier for the selected result shape. */
declare const outputType: unique symbol;

export interface CompiledQuery<O = unknown> {
  readonly query: SelectQueryNode;
  readonly soql: string;
  readonly [outputType]?: O;
}
