import {
  OrderByItemNode,
  type OrderByDirection,
  type OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type { FieldName, FieldsOf } from "#/parser/reference-parser";

export type SortableFieldName<DB, TB extends keyof DB> = {
  [Field in FieldName<DB, TB>]: FieldsOf<DB, TB>[Field] extends {
    readonly sortable: true;
  }
    ? Field
    : never;
}[FieldName<DB, TB>];

export function parseOrderBy(
  field: string,
  direction?: OrderByDirection,
  nulls?: OrderByNulls,
): OrderByItemNode {
  return OrderByItemNode.create(ReferenceNode.create(field), direction, nulls);
}
