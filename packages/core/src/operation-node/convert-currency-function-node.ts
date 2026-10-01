import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a convertCurrency() expression. */
export interface ConvertCurrencyFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ConvertCurrencyFunctionNode";
  /** Field or relationship reference passed to the expression. */
  readonly reference: ReferenceNode;
}

export const ConvertCurrencyFunctionNode = {
  create(reference: ReferenceNode): ConvertCurrencyFunctionNode {
    return freeze({
      kind: "ConvertCurrencyFunctionNode",
      reference,
    });
  },
};
