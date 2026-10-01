import type { SelectQueryNode } from "#/operation-node/select-query-node";

export function validateForUpdateQuery(query: SelectQueryNode): void {
  if (!query.forUpdate) {
    return;
  }

  if (query.orderBy) {
    throw new Error("SOQL FOR UPDATE cannot be combined with ORDER BY.");
  }
}
