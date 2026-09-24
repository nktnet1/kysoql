import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryId } from "#/query-id";

export interface QueryCompileContext {
  readonly apex?: boolean;
  readonly dynamicApex?: boolean;
  /** @internal Correlates plugin query and result transforms. */
  readonly queryId?: QueryId;
}

export interface QueryCompiler {
  compileQuery<O = unknown>(
    query: SelectQueryNode,
    context?: QueryCompileContext,
  ): CompiledQuery<O>;
}
