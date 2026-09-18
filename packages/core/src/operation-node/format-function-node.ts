import type { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface FormatFunctionNode {
  readonly kind: "FormatFunctionNode";
  readonly expression: ConvertCurrencyFunctionNode | ReferenceNode;
}

export const FormatFunctionNode = {
  create(
    expression: ConvertCurrencyFunctionNode | ReferenceNode,
  ): FormatFunctionNode {
    return freeze({
      kind: "FormatFunctionNode",
      expression,
    });
  },
};
