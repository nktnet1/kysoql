import type { CompiledQuery } from "#/query-compiler/compiled-query";

/**
 * Minimal structural contract used for query cancellation.
 *
 * Native `AbortSignal` instances satisfy this interface without requiring
 * `@kysoql/core` to depend on DOM or Node ambient types.
 */
export interface QueryAbortSignal {
  /** Whether cancellation has already been requested. */
  readonly aborted: boolean;
  /** Reason supplied when the signal was aborted. */
  readonly reason: unknown;
  /** Throws the signal reason when cancellation has already been requested. */
  throwIfAborted(): void;
  /** Registers an abort listener using the `AbortSignal`-compatible contract. */
  addEventListener(
    type: "abort",
    listener: () => void,
    options?: {
      /** Remove the listener automatically after the first abort event. */
      readonly once?: boolean;
    },
  ): void;
  /** Removes a previously registered abort listener. */
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Options shared by executable query builders and query executors. */
export interface AbortableQueryOptions {
  /** Abort waiting for this query without affecting unrelated operations. */
  readonly signal?: QueryAbortSignal;
}

/** Execution adapter contract used by query builders and QueryCreator. */
export interface QueryExecutor {
  /** Executes a compiled SOQL query using normal Salesforce query semantics. */
  executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;

  /** Executes a compiled query using Salesforce query-all semantics when supported. */
  executeAllQuery?<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]>;

  /** Executes a compiled `COUNT()` query and returns its numeric result. */
  executeCountQuery?(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;

  /** Executes `COUNT()` using Salesforce query-all semantics when supported. */
  executeAllCountQuery?(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number>;
}
