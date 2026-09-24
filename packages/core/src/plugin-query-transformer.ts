import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { KysoqlPlugin } from "#/plugin";
import type { QueryId } from "#/query-id";

export function transformQueryWithPlugins(
  query: SelectQueryNode,
  plugins: readonly KysoqlPlugin[],
  queryId: QueryId,
): SelectQueryNode {
  let transformedQuery = query;

  for (const plugin of plugins) {
    transformedQuery = plugin.transformQuery({
      queryId,
      query: transformedQuery,
    });
  }

  return transformedQuery;
}
