import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { ConvertCurrencyFunctionNode } from "#/operation-node/convert-currency-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a FORMAT() expression. */
export interface FormatFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "FormatFunctionNode";
  /** Expression wrapped by this function node. */
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
