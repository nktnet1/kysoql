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
        }
      ? Reference
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
