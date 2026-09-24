import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { KysoqlPlugin } from "#/plugin";

export function transformQueryWithPlugins(
  query: SelectQueryNode,
  plugins: readonly KysoqlPlugin[],
): SelectQueryNode {
  let transformedQuery = query;

  for (const plugin of plugins) {
    transformedQuery = plugin.transformQuery({ query: transformedQuery });
  }

  return transformedQuery;
}
