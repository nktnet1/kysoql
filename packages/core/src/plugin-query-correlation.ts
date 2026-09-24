import type { CompiledQuery } from "#/query-compiler/compiled-query";
import { createQueryId, type QueryId } from "#/query-id";

const queryIds = new WeakMap<CompiledQuery<unknown>, QueryId>();

export const setCompiledQueryId = (
  compiledQuery: CompiledQuery<unknown>,
  queryId: QueryId,
): void => {
  queryIds.set(compiledQuery, queryId);
};

export const getOrCreateCompiledQueryId = (
  compiledQuery: CompiledQuery<unknown>,
): QueryId => {
  const existing = queryIds.get(compiledQuery);
  if (existing) {
    return existing;
  }

  const queryId = createQueryId();
  queryIds.set(compiledQuery, queryId);
  return queryId;
};
