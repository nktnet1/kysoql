import * as v from "valibot";

import type { DistanceFunctionExpression } from "#src/expression/geolocation-function-builder";
import { BinaryOperationNode } from "#src/operation-node/binary-operation-node";
import type { ComparisonOperator } from "#src/operation-node/operator-node";
import { OperatorNode } from "#src/operation-node/operator-node";
import { ValueNode } from "#src/operation-node/value-node";

/** Comparison operators accepted for Salesforce DISTANCE() predicates. */
export type DistanceComparisonOperator = "<" | ">";

const DISTANCE_FILTER_OPERATOR_ERROR =
  "SOQL DISTANCE() filters only support < or > comparisons.";
const DISTANCE_FILTER_VALUE_ERROR =
  "SOQL DISTANCE() filters require a finite numeric distance.";
const distanceFilterValueSchema = v.pipe(
  v.number(DISTANCE_FILTER_VALUE_ERROR),
  v.finite(DISTANCE_FILTER_VALUE_ERROR),
);

export function parseDistanceFilterBinaryOperation(
  expression: DistanceFunctionExpression<unknown, boolean, boolean>,
  operator: ComparisonOperator,
  distance: unknown,
): BinaryOperationNode {
  const node = expression.toOperationNode();

  if (node.kind !== "DistanceFunctionNode") {
    throw new TypeError(
      "SOQL geolocation filters require an unaliased DISTANCE() expression.",
    );
  }

  if (operator !== "<" && operator !== ">") {
    throw new TypeError(DISTANCE_FILTER_OPERATOR_ERROR);
  }

  const parsedDistance = v.safeParse(distanceFilterValueSchema, distance);

  if (!parsedDistance.success) {
    throw new TypeError(parsedDistance.issues[0].message);
  }

  return BinaryOperationNode.create(
    node,
    OperatorNode.create(operator),
    ValueNode.create(parsedDistance.output),
  );
}
