import type { CompiledQuery } from "#/query-compiler/compiled-query";

export interface QueryExecutor {
  executeQuery<O>(compiledQuery: CompiledQuery<O>): Promise<readonly O[]>;
}
