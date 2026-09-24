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
    const nextQuery = plugin.transformQuery({
      queryId,
      query: transformedQuery,
    });

    if (
      typeof nextQuery !== "object" ||
      nextQuery === null ||
      nextQuery.kind !== "SelectQueryNode"
    ) {
      throw new TypeError(
        "KysoqlPlugin.transformQuery must return a SelectQueryNode.",
      );
    }

    transformedQuery = nextQuery;
  }

  return transformedQuery;
}
