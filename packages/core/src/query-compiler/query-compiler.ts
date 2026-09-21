import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";

export interface QueryCompileContext {
  readonly apex?: boolean;
}

export interface QueryCompiler {
  compileQuery<O = unknown>(
    query: SelectQueryNode,
    context?: QueryCompileContext,
  ): CompiledQuery<O>;
}
