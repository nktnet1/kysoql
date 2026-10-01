import type { KysoqlPlugin } from "#/plugin";
import { getOrCreateCompiledQueryId } from "#/plugin-query-correlation";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";

const transformResult = async <Result>(
  plugins: readonly KysoqlPlugin[],
  compiledQuery: CompiledQuery<unknown>,
  initialResult: Result,
): Promise<Result> => {
  let result = initialResult;
  const queryId = getOrCreateCompiledQueryId(compiledQuery);

  for (const plugin of plugins) {
    if (plugin.transformResult) {
      result = await plugin.transformResult({
        queryId,
        query: compiledQuery,
        result,
      });
    }
  }

  return result;
};

export const createPluginQueryExecutor = (
  executor: QueryExecutor,
  plugins: readonly KysoqlPlugin[],
): QueryExecutor => {
  const pluginExecutor: QueryExecutor = {
    async executeQuery<O>(
      compiledQuery: CompiledQuery<O>,
      options?: AbortableQueryOptions,
    ) {
      const result = await executor.executeQuery<O>(compiledQuery, options);
      return transformResult(plugins, compiledQuery, result);
    },
  };

  const executeAllQuery = executor.executeAllQuery;
  if (executeAllQuery) {
    const executeAllQueryFor = <O>(
      compiledQuery: CompiledQuery<O>,
      options?: AbortableQueryOptions,
    ): Promise<readonly O[]> =>
      executeAllQuery.call(executor, compiledQuery, options) as Promise<
        readonly O[]
      >;

    pluginExecutor.executeAllQuery = async <O>(
      compiledQuery: CompiledQuery<O>,
      options?: AbortableQueryOptions,
    ) => {
      const result = await executeAllQueryFor(compiledQuery, options);
      return transformResult(plugins, compiledQuery, result);
    };
  }

  const executeCountQuery = executor.executeCountQuery;
  if (executeCountQuery) {
    pluginExecutor.executeCountQuery = async (
      compiledQuery: CompiledQuery<number>,
      options?: AbortableQueryOptions,
    ) => {
      const result = await executeCountQuery.call(
        executor,
        compiledQuery,
        options,
      );
      return transformResult(plugins, compiledQuery, result);
    };
  }

  const executeAllCountQuery = executor.executeAllCountQuery;
  if (executeAllCountQuery) {
    pluginExecutor.executeAllCountQuery = async (
      compiledQuery: CompiledQuery<number>,
      options?: AbortableQueryOptions,
    ) => {
      const result = await executeAllCountQuery.call(
        executor,
        compiledQuery,
        options,
      );
      return transformResult(plugins, compiledQuery, result);
    };
  }

  return pluginExecutor;
};
