import { freeze } from "#/util/object-utils";

export type EqualityComparisonOperator = "=" | "!=";
export type OrderedComparisonOperator = "<" | "<=" | ">" | ">=";
export type LikeComparisonOperator = "like";
export type SetComparisonOperator = "in" | "not in";

export type ComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | LikeComparisonOperator
  | SetComparisonOperator;

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
