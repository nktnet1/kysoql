import type { CompiledQuery } from "#/query-compiler/compiled-query";

export interface QueryExecutor {
  executeQuery<O>(compiledQuery: CompiledQuery<O>): Promise<readonly O[]>;

  executeAllQuery?<O>(compiledQuery: CompiledQuery<O>): Promise<readonly O[]>;

  executeCountQuery?(compiledQuery: CompiledQuery<number>): Promise<number>;

  executeAllCountQuery?(compiledQuery: CompiledQuery<number>): Promise<number>;
}
