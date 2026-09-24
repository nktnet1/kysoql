import type { CompiledQuery } from "#/query-compiler/compiled-query";

/**
 * Minimal structural contract used for query cancellation.
 *
 * Native `AbortSignal` instances satisfy this interface without requiring
 * `@kysoql/core` to depend on DOM or Node ambient types.
 */
export interface QueryAbortSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  throwIfAborted(): void;
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: { readonly once?: boolean },
  ): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Options shared by executable query builders and query executors. */
export interface AbortableQueryOptions {
  /** Abort waiting for this query without affecting unrelated operations. */
  readonly signal?: QueryAbortSignal;
}

export interface QueryExecutor {
  executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;

  executeAllQuery?<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;

  executeCountQuery?(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;

  executeAllCountQuery?(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
}
