import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { FormatFunctionNode } from "#/operation-node/format-function-node";
import type { AdvancedGroupByMode } from "#/operation-node/group-by-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";

export type GroupableFieldName<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly groupable: true;
          readonly salesforceType: infer SalesforceType extends string;
        }
      ? SalesforceType extends "location"
        ? never
        : Reference
      : never
  : never;

const EMPTY_GROUP_BY_ERROR =
  "SOQL GROUP BY field lists must contain at least one field.";

export function parseGroupBy(
  groupBy: string | ReadonlyArray<string>,
): readonly ReferenceNode[] {
  const fields = Array.isArray(groupBy) ? groupBy : [groupBy];

  if (fields.length === 0) {
    throw new TypeError(EMPTY_GROUP_BY_ERROR);
  }

  return fields.map((field) => ReferenceNode.create(field));
}

export function parseAdvancedGroupBy(
  groupBy: string | ReadonlyArray<string>,
  mode: AdvancedGroupByMode,
  existingFieldCount: number,
): readonly ReferenceNode[] {
  const items = parseGroupBy(groupBy);

  if (existingFieldCount + items.length > 3) {
    throw new TypeError(
      `SOQL GROUP BY ${mode.toUpperCase()} can include at most three fields.`,
    );
  }

  return items;
}

export function assertCanClearGroupBy(queryNode: SelectQueryNode): void {
  if (!queryNode.groupBy) {
    return;
  }

  if (queryNode.having || queryNode.orderBy || queryNode.limit) {
    throw new TypeError(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, or LIMIT clauses remain.",
    );
  }

  for (const selection of queryNode.selections ?? []) {
    const node = selection.selection;

    if (node.kind !== "AliasNode") {
      throw new TypeError(
        "SOQL clearGroupBy() cannot remove GROUP BY while grouped field selections remain.",
      );
    }

    if (
      node.node.kind === "DateFunctionNode" ||
      (node.node.kind === "AggregateFunctionNode" &&
        (node.node as AggregateFunctionNode).function === "grouping") ||
      isGroupingFormatSelection(node.node)
    ) {
      throw new TypeError(
        "SOQL clearGroupBy() cannot remove GROUP BY while grouping-dependent selections remain.",
      );
    }
  }
}

function isGroupingFormatSelection(node: { readonly kind: string }): boolean {
  if (node.kind !== "FormatFunctionNode") {
    return false;
  }

  const expression = (node as FormatFunctionNode).expression;
  return (
    expression.kind === "AggregateFunctionNode" &&
    expression.function === "grouping"
  );
}
