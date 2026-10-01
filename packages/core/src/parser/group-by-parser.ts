import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { FormatFunctionNode } from "#src/operation-node/format-function-node";
import type { AdvancedGroupByMode } from "#src/operation-node/group-by-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import type { FieldReferenceDefinition } from "#src/parser/reference-parser";

type HasCustomRelationshipSegment<Reference extends string> =
  Lowercase<Reference> extends `${string}__r.${string}` ? true : false;

export type GroupableFieldName<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? HasCustomRelationshipSegment<Reference> extends true
    ? never
    : [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
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

const CUSTOM_RELATIONSHIP_GROUP_BY_ERROR =
  "SOQL queries using GROUP BY cannot use custom relationship expressions with __r.";

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

export function validateGroupByQuery(queryNode: SelectQueryNode): void {
  if (!queryNode.groupBy) {
    return;
  }

  if (containsCustomRelationshipExpression(queryNode)) {
    throw new TypeError(CUSTOM_RELATIONSHIP_GROUP_BY_ERROR);
  }
}

function containsCustomRelationshipExpression(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsCustomRelationshipExpression);
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as Record<string, unknown>;

  if (node.kind === "ValueNode" || node.kind === "ApexLiteralNode") {
    return false;
  }

  if (
    node.kind === "ReferenceNode" &&
    typeof node.name === "string" &&
    node.name
      .toLowerCase()
      .split(".")
      .some((segment) => segment.endsWith("__r"))
  ) {
    return true;
  }

  return Object.values(node).some(containsCustomRelationshipExpression);
}

export function assertCanClearGroupBy(queryNode: SelectQueryNode): void {
  if (!queryNode.groupBy) {
    return;
  }

  if (
    queryNode.having ||
    queryNode.orderBy ||
    queryNode.limit ||
    queryNode.offset
  ) {
    throw new TypeError(
      "SOQL clearGroupBy() cannot remove GROUP BY while grouped HAVING, ORDER BY, LIMIT, or OFFSET clauses remain.",
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
