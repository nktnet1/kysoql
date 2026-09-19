import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface ConvertTimezoneFunctionNode {
  readonly kind: "ConvertTimezoneFunctionNode";
  readonly reference: ReferenceNode;
}

export const ConvertTimezoneFunctionNode = {
  create(reference: ReferenceNode): ConvertTimezoneFunctionNode {
    if (reference.kind !== "ReferenceNode") {
      throw new TypeError(
        "SOQL convertTimezone() requires a datetime field reference.",
      );
    }

    return freeze({
      kind: "ConvertTimezoneFunctionNode",
      reference,
    });
  },
};
