import type { SelectQueryNode } from "#src/operation-node/select-query-node";

/** Type-only carrier for the selected result shape. */
declare const outputType: unique symbol;

/**
 * Compiled SOQL text paired with the immutable query AST that produced it.
 */
export interface CompiledQuery<O = unknown> {
  /** Immutable operation tree that produced the compiled query. */
  readonly query: SelectQueryNode;
  /** Compiled SOQL text sent to Salesforce. */
  readonly soql: string;
  /** Type-only marker carrying the query output type; no runtime value is emitted. */
  readonly [outputType]?: O;
}
