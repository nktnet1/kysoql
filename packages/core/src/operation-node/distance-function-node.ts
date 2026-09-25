import * as v from "valibot";

import type { GeolocationFunctionNode } from "#/operation-node/geolocation-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Units accepted by Salesforce DISTANCE() expressions. */
export type DistanceUnit = "km" | "mi";
/**
 * Immutable query AST node for the destination of a DISTANCE() expression.
 */
export type DistanceDestinationNode = ReferenceNode | GeolocationFunctionNode;

const DISTANCE_UNIT_ERROR = "SOQL DISTANCE() unit must be 'mi' or 'km'.";
const distanceUnitSchema = v.picklist(
  ["mi", "km"] as const,
  DISTANCE_UNIT_ERROR,
);

/** Immutable query AST node for a DISTANCE() expression. */
export interface DistanceFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "DistanceFunctionNode";
  /** Source geolocation field/reference. */
  readonly location: ReferenceNode;
  /** Destination geolocation expression or field/reference. */
  readonly destination: DistanceDestinationNode;
  /** Distance unit emitted in the SOQL function call. */
  readonly unit: DistanceUnit;
}

export const DistanceFunctionNode = {
  create(
    location: ReferenceNode,
    destination: DistanceDestinationNode,
    unit: DistanceUnit,
  ): DistanceFunctionNode {
    if (location.kind !== "ReferenceNode") {
      throw new TypeError(
        "SOQL DISTANCE() requires a location field reference as its first argument.",
      );
    }

    if (
      destination.kind !== "ReferenceNode" &&
      destination.kind !== "GeolocationFunctionNode"
    ) {
      throw new TypeError(
        "SOQL DISTANCE() requires a location field reference or GEOLOCATION() expression as its second argument.",
      );
    }

    const parsedUnit = v.safeParse(distanceUnitSchema, unit);

    if (!parsedUnit.success) {
      throw new TypeError(parsedUnit.issues[0].message);
    }

    return freeze({
      kind: "DistanceFunctionNode",
      location,
      destination,
      unit: parsedUnit.output,
    });
  },
};
