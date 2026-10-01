import type { ReferenceNode } from "#src/operation-node/reference-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a convertTimezone() expression. */
export interface ConvertTimezoneFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ConvertTimezoneFunctionNode";
  /** Field or relationship reference passed to the expression. */
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
