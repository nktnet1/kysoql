import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { CompiledQuery } from "#src/query-compiler/compiled-query";
import type { QueryId } from "#src/query-id";

/** Arguments passed to a plugin before a query is compiled. */
export interface PluginTransformQueryArgs {
  /** Identifier shared across query and result plugin hooks for one execution. */
  readonly queryId: QueryId;
  /** Operation tree about to be compiled or executed. */
  readonly query: SelectQueryNode;
}

/** Arguments passed to a plugin after a query has executed. */
export interface PluginTransformResultArgs<Result> {
  /** Identifier shared across query and result plugin hooks for one execution. */
  readonly queryId: QueryId;
  /** Final operation tree associated with the returned result. */
  readonly query: CompiledQuery<unknown>;
  /** Result value produced by the executor before this plugin transforms it. */
  readonly result: Result;
}

/**
 * Hook contract for transforming Kysoql query trees and execution results.
 *
 * Query transforms run in registration order before compilation. Result
 * transforms run in the same order after the configured executor resolves.
 */
export interface KysoqlPlugin {
  /** Transforms an operation tree before compilation. Return the original node when no change is needed. */
  transformQuery(args: PluginTransformQueryArgs): SelectQueryNode;
  /** Transforms an executor result after the query completes. */
  transformResult?<Result>(
    args: PluginTransformResultArgs<Result>,
  ): Promise<Result> | Result;
}
