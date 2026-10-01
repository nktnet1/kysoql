import type { SelectQueryNode } from "#src/operation-node/select-query-node";

export function validateAllRowsQuery(query: SelectQueryNode): void {
  if (!query.allRows) {
    return;
  }

  if (query.forUpdate) {
    throw new Error("SOQL ALL ROWS cannot be combined with FOR UPDATE.");
  }
}
