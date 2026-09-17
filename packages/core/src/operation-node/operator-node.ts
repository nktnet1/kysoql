import { freeze } from "../util/object-utils.js";

export type EqualityComparisonOperator = "=" | "!=";
export type OrderedComparisonOperator = "<" | "<=" | ">" | ">=";
export type LikeComparisonOperator = "like";

export type ComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | LikeComparisonOperator;

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
