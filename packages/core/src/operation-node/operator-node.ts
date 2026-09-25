import { freeze } from "#/util/object-utils";

/** SOQL equality comparison operators. */
export type EqualityComparisonOperator = "=" | "!=";
/** SOQL ordered comparison operators. */
export type OrderedComparisonOperator = "<" | "<=" | ">" | ">=";
/** SOQL LIKE comparison operator. */
export type LikeComparisonOperator = "like";
/** SOQL IN and NOT IN comparison operators. */
export type SetComparisonOperator = "in" | "not in";
/** SOQL INCLUDES and EXCLUDES operators for multi-select picklists. */
export type MultiSelectComparisonOperator = "includes" | "excludes";

/** Union of comparison operators supported by Kysoql filters. */
export type ComparisonOperator =
  | EqualityComparisonOperator
  | OrderedComparisonOperator
  | LikeComparisonOperator
  | SetComparisonOperator
  | MultiSelectComparisonOperator;

/** Immutable query AST node for a comparison operator. */
export interface OperatorNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "OperatorNode";
  /** SOQL comparison or arithmetic operator. */
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
