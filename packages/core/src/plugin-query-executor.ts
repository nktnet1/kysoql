import type { KysoqlPlugin } from "#/plugin";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";

const transformResult = async <Result>(
  plugins: readonly KysoqlPlugin[],
  compiledQuery: CompiledQuery<unknown>,
  initialResult: Result,
): Promise<Result> => {
  let result = initialResult;

  for (const plugin of plugins) {
    if (plugin.transformResult) {
      result = await plugin.transformResult({
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
): QueryExecutor => ({
  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ) {
    const result = await executor.executeQuery<O>(compiledQuery, options);
    return transformResult(plugins, compiledQuery, result);
  },
  ...(executor.executeAllQuery
    ? {
        async executeAllQuery<O>(
          compiledQuery: CompiledQuery<O>,
          options?: AbortableQueryOptions,
        ) {
          const result = await executor.executeAllQuery!(
            compiledQuery,
            options,
          );
          return transformResult(plugins, compiledQuery, result);
        },
      }
    : {}),
  ...(executor.executeCountQuery
    ? {
        async executeCountQuery(
          compiledQuery: CompiledQuery<number>,
          options?: AbortableQueryOptions,
        ) {
          const result = await executor.executeCountQuery!(
            compiledQuery,
            options,
          );
          return transformResult(plugins, compiledQuery, result);
        },
      }
    : {}),
  ...(executor.executeAllCountQuery
    ? {
        async executeAllCountQuery(
          compiledQuery: CompiledQuery<number>,
          options?: AbortableQueryOptions,
        ) {
          const result = await executor.executeAllCountQuery!(
            compiledQuery,
            options,
          );
          return transformResult(plugins, compiledQuery, result);
        },
      }
    : {}),
});
