import { freeze } from "../util/object-utils.js";

export type ComparisonOperator = "=" | "!=";

export interface OperatorNode {
  readonly kind: "OperatorNode";
  readonly operator: ComparisonOperator;
}

export const OperatorNode = {
  create(operator: ComparisonOperator): OperatorNode {
    return freeze({
      kind: "OperatorNode",
      operator,
    });
  },
};
