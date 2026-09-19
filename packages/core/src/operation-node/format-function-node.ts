import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface FormatFunctionNode {
  readonly kind: "FormatFunctionNode";
  readonly expression:
    | AggregateFunctionNode
    | ConvertCurrencyFunctionNode
    | ReferenceNode;
}

export const FormatFunctionNode = {
  create(
    expression:
      | AggregateFunctionNode
      | ConvertCurrencyFunctionNode
      | ReferenceNode,
  ): FormatFunctionNode {
    return freeze({
      kind: "FormatFunctionNode",
      expression,
    });
  },
};
