import {
  OrderByItemNode,
  type OrderByDirection,
} from "../operation-node/order-by-item-node.js";
import { ReferenceNode } from "../operation-node/reference-node.js";
import type { FieldName, FieldsOf } from "./reference-parser.js";

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
): OrderByItemNode {
  return OrderByItemNode.create(ReferenceNode.create(field), direction);
}
