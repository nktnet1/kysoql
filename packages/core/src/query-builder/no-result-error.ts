import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { AbortableQueryOptions } from "#/query-executor";

export type NoResultErrorConstructor = new (node: SelectQueryNode) => Error;

export interface ExecuteTakeFirstOrThrowOptions extends AbortableQueryOptions {
  readonly errorConstructor?:
    | NoResultErrorConstructor
    | ((node: SelectQueryNode) => Error);
}

/** Error thrown by `executeTakeFirstOrThrow()` when a query returns no rows. */
export class NoResultError extends Error {
  readonly node: SelectQueryNode;

  constructor(node: SelectQueryNode) {
    super("no result");
    this.node = node;
  }
}

export const isNoResultErrorConstructor = (
  value: NoResultErrorConstructor | ((node: SelectQueryNode) => Error),
): value is NoResultErrorConstructor =>
  Object.prototype.hasOwnProperty.call(value, "prototype");
