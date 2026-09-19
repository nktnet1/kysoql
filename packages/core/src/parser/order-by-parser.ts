import type {
  AggregateFunctionExpression,
  GroupingFunctionBuilder,
} from "#/expression/aggregate-function-builder";
import type { DistanceFunctionExpression } from "#/expression/geolocation-function-builder";
import {
  type OrderByDirection,
  OrderByItemNode,
  type OrderByNulls,
} from "#/operation-node/order-by-item-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { parseGroupingFunctionExpression } from "#/parser/grouping-expression-parser";
import type { FieldReferenceDefinition } from "#/parser/reference-parser";

export type SortableFieldName<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : FieldReferenceDefinition<DB, TB, Reference> extends {
          readonly sortable: true;
          readonly salesforceType: infer SalesforceType extends string;
        }
      ? SalesforceType extends "location"
        ? never
        : Reference
      : never
  : never;

export function parseOrderBy(
  field: string,
  direction?: OrderByDirection,
  nulls?: OrderByNulls,
): OrderByItemNode {
  return OrderByItemNode.create(ReferenceNode.create(field), direction, nulls);
}

export function parseAggregateOrderBy(
  expression: AggregateFunctionExpression<unknown>,
  direction?: OrderByDirection,
  nulls?: OrderByNulls,
): OrderByItemNode {
  const node = expression.toOperationNode();

  if (
    node.kind !== "AggregateFunctionNode" ||
    node.function === "grouping" ||
    node.reference === undefined
  ) {
    throw new TypeError(
      "SOQL aggregate ORDER BY callbacks must return an unaliased aggregate function with a field argument.",
    );
  }

  return OrderByItemNode.create(node, direction, nulls);
}

export function parseGroupingOrderBy(
  expression: GroupingFunctionBuilder,
  groupingFields: readonly string[],
  direction?: OrderByDirection,
): OrderByItemNode {
  return OrderByItemNode.create(
    parseGroupingFunctionExpression(expression, groupingFields),
    direction,
  );
}

export function parseDistanceOrderBy(
  expression: DistanceFunctionExpression<unknown, boolean, true>,
  direction?: OrderByDirection,
  nulls?: OrderByNulls,
): OrderByItemNode {
  const node = expression.toOperationNode();

  if (node.kind !== "DistanceFunctionNode") {
    throw new TypeError(
      "SOQL geolocation ORDER BY callbacks must return an unaliased DISTANCE() expression.",
    );
  }

  return OrderByItemNode.create(node, direction, nulls);
}
