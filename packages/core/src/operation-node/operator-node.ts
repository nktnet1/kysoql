import { freeze } from "#/util/object-utils";

export type EqualityComparisonOperator = "=" | "!=";
export type OrderedComparisonOperator = "<" | "<=" | ">" | ">=";
export type LikeComparisonOperator = "like";
export type SetComparisonOperator = "in" | "not in";
export type MultiSelectComparisonOperator = "includes" | "excludes";

export type ComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | LikeComparisonOperator
  | SetComparisonOperator
  | MultiSelectComparisonOperator;

export interface OperatorNode {
  readonly kind: "OperatorNode";
  readonly operator: ComparisonOperator;
}

const comparisonOperators = new Set<ComparisonOperator>([
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "like",
  "in",
  "not in",
  "includes",
  "excludes",
]);

export const OperatorNode = {
  create(operator: ComparisonOperator): OperatorNode {
    if (!comparisonOperators.has(operator)) {
      throw new TypeError("Unsupported SOQL comparison operator.");
    }

    return freeze({
      kind: "OperatorNode",
      operator,
    });
  },
};
