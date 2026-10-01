import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { AbortableQueryOptions } from "#src/query-executor";

/**
 * Error constructor accepted by executeTakeFirstOrThrow() when no row is
 * returned.
 */
export type NoResultErrorConstructor = new (node: SelectQueryNode) => Error;

/**
 * Options for customising the error thrown when a query returns no rows.
 */
export interface ExecuteTakeFirstOrThrowOptions extends AbortableQueryOptions {
  /** Error constructor or factory used when the query returns no rows. */
  readonly errorConstructor?:
    | NoResultErrorConstructor
    | ((node: SelectQueryNode) => Error);
}

/** Error thrown by `executeTakeFirstOrThrow()` when a query returns no rows. */
export class NoResultError extends Error {
  /** SELECT operation tree that produced no result. */
  readonly node: SelectQueryNode;

  /** Creates an error for a SELECT query that returned no rows. */
  constructor(node: SelectQueryNode) {
    super("no result");
    this.node = node;
  }
}

export const isNoResultErrorConstructor = (
  value: NoResultErrorConstructor | ((node: SelectQueryNode) => Error),
): value is NoResultErrorConstructor => Object.hasOwn(value, "prototype");
