import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type { QueryId } from "#src/query-id";

/**
 * Additional schema metadata and mode supplied while compiling a query.
 */
export interface QueryCompileContext {
  /** Whether the query is being compiled for Apex syntax. */
  readonly apex?: boolean;
  /** Whether Apex bind values must be emitted for dynamic `Database.query*` APIs. */
  readonly dynamicApex?: boolean;
  /** @internal Correlates plugin query and result transforms. */
  readonly queryId?: QueryId;
}

/**
 * Compiler contract for turning a SelectQueryNode into executable SOQL.
 */
export interface QueryCompiler {
  /** Compiles an operation tree into SOQL while preserving its output type. */
  compileQuery<O = unknown>(
    query: SelectQueryNode,
    context?: QueryCompileContext,
  ): CompiledQuery<O>;
}
