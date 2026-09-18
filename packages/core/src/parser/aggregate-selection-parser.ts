import type {
  AliasedAggregateFunctionBuilder,
  CountAllFunctionBuilder,
} from "#/expression/aggregate-function-builder";
import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import { SelectionNode } from "#/operation-node/selection-node";

export type AggregateSelectionExpression = AliasedAggregateFunctionBuilder<
  unknown,
  string
>;

export type AggregateSelectionArg =
  | AggregateSelectionExpression
  | readonly AggregateSelectionExpression[];

type AggregateSelectionOutput<Selection> =
  Selection extends AliasedAggregateFunctionBuilder<
    infer Output,
    infer Alias extends string
  >
    ? { readonly [Key in Alias]: Output }
    : never;

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

export type AggregateSelection<Selection> = Selection extends readonly (
  infer Item
)[]
  ? UnionToIntersection<AggregateSelectionOutput<Item>>
  : AggregateSelectionOutput<Selection>;

const AGGREGATE_SELECTION_ERROR =
  "SOQL aggregate selections must be aliased aggregate function expressions.";
const EMPTY_AGGREGATE_SELECTION_ERROR =
  "SOQL aggregate selection lists must contain at least one expression.";
const COUNT_SELECTION_ERROR =
  "SOQL COUNT() must be selected by itself without an alias.";

function parseAliasedAggregateNode(expression: unknown): AliasNode {
  if (
    typeof expression !== "object" ||
    expression === null ||
    !("toOperationNode" in expression) ||
    typeof expression.toOperationNode !== "function"
  ) {
    throw new TypeError(AGGREGATE_SELECTION_ERROR);
  }

  const node = expression.toOperationNode() as AliasNode;

  if (
    node.kind !== "AliasNode" ||
    node.node.kind !== "AggregateFunctionNode"
  ) {
    throw new TypeError(AGGREGATE_SELECTION_ERROR);
  }

  return node;
}

export function parseAggregateSelectArg(
  selection: AggregateSelectionArg,
): readonly SelectionNode[] {
  const selections = Array.isArray(selection) ? selection : [selection];

  if (selections.length === 0) {
    throw new TypeError(EMPTY_AGGREGATE_SELECTION_ERROR);
  }

  const aliases = new Set<string>();

  return selections.map((expression) => {
    const node = parseAliasedAggregateNode(expression);

    if (aliases.has(node.alias)) {
      throw new TypeError(
        `Duplicate SOQL aggregate selection alias: ${node.alias}.`,
      );
    }

    aliases.add(node.alias);
    return SelectionNode.create(node);
  });
}

export function parseCountSelectArg(
  selection: CountAllFunctionBuilder,
): SelectionNode {
  const node = selection.toOperationNode() as AggregateFunctionNode;

  if (
    node.kind !== "AggregateFunctionNode" ||
    node.function !== "count" ||
    node.reference !== undefined
  ) {
    throw new TypeError(COUNT_SELECTION_ERROR);
  }

  return SelectionNode.create(node);
}
