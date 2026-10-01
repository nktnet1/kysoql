import type { ReferenceNode } from "#src/operation-node/reference-node";
import { freeze } from "#src/util/object-utils";

/**
 * Arithmetic operators supported by Salesforce formula filter functions.
 */
export type FormulaArithmeticOperator = "+" | "-";

/** Immutable query AST node for a Salesforce formula filter function. */
export interface FormulaFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "FormulaFunctionNode";
  /** Left operand of the operation. */
  readonly leftOperand: ReferenceNode;
  /** SOQL comparison or arithmetic operator. */
  readonly operator: FormulaArithmeticOperator;
  /** Right operand of the operation. */
  readonly rightOperand: ReferenceNode;
}

export const FormulaFunctionNode = {
  create(
    leftOperand: ReferenceNode,
    operator: FormulaArithmeticOperator,
    rightOperand: ReferenceNode,
  ): FormulaFunctionNode {
    if (
      leftOperand.kind !== "ReferenceNode" ||
      rightOperand.kind !== "ReferenceNode"
    ) {
      throw new TypeError("SOQL FORMULA() operands must be field references.");
    }

    if (operator !== "+" && operator !== "-") {
      throw new TypeError("SOQL FORMULA() supports only + and - arithmetic.");
    }

    return freeze({
      kind: "FormulaFunctionNode",
      leftOperand,
      operator,
      rightOperand,
    });
  },
};
