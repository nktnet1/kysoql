import type { CompiledQuery } from "#/query-compiler/compiled-query";

/** Options shared by executable query builders and query executors. */
export interface AbortableQueryOptions {
  /** Abort waiting for this query without affecting unrelated operations. */
  readonly signal?: AbortSignal;
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
