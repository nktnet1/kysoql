import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface ConvertCurrencyFunctionNode {
  readonly kind: "ConvertCurrencyFunctionNode";
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
