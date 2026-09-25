let nextQueryId = 0;

/** Identifies a single query transformation/execution lifecycle. */
export interface QueryId {
  /** Opaque numeric identifier for a query instance. */
  readonly queryId: string;
}

export const createQueryId = (): QueryId => {
  nextQueryId += 1;
  return { queryId: `kysoql-${nextQueryId}` };
};
