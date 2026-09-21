import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export type FormulaArithmeticOperator = "+" | "-";

export interface FormulaFunctionNode {
  readonly kind: "FormulaFunctionNode";
  readonly leftOperand: ReferenceNode;
  readonly operator: FormulaArithmeticOperator;
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
