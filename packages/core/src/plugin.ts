import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryId } from "#/query-id";

/** Arguments passed to a plugin before a query is compiled. */
export interface PluginTransformQueryArgs {
  readonly queryId: QueryId;
  readonly query: SelectQueryNode;
}

/** Arguments passed to a plugin after a query has executed. */
export interface PluginTransformResultArgs<Result> {
  readonly queryId: QueryId;
  readonly query: CompiledQuery<unknown>;
  readonly result: Result;
}

/**
 * Hook contract for transforming Kysoql query trees and execution results.
 *
 * Query transforms run in registration order before compilation. Result
 * transforms run in the same order after the configured executor resolves.
 */
export interface KysoqlPlugin {
  transformQuery(args: PluginTransformQueryArgs): SelectQueryNode;
  transformResult?<Result>(
    args: PluginTransformResultArgs<Result>,
  ): Promise<Result> | Result;
}
