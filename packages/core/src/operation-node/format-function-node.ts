import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { ConvertCurrencyFunctionNode } from "#src/operation-node/convert-currency-function-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import { freeze } from "#src/util/object-utils";

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
