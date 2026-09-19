import type { SelectQueryNode } from "#/operation-node/select-query-node";

export function validateApexAccessModeQuery(query: SelectQueryNode): void {
  if (!query.apexAccessMode) {
    return;
  }

  if (query.withDataCategory || query.userProfileFeedWith) {
    throw new Error(
      "SOQL Apex access modes cannot be combined with another WITH filtering clause.",
    );
  }
}
