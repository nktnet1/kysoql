import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";

export interface QueryCompiler {
  compileQuery<O = unknown>(query: SelectQueryNode): CompiledQuery<O>;
}
