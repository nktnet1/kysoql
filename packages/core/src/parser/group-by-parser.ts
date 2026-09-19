import type { AdvancedGroupByMode } from "#/operation-node/group-by-node";
import { ReferenceNode } from "#/operation-node/reference-node";
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
