import type { GroupingFunctionBuilder } from "#src/expression/aggregate-function-builder";
import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import type { SelectionNode } from "#src/operation-node/selection-node";

const GROUPING_FIELD_ERROR =
  "SOQL GROUPING() is available only for fields in GROUP BY ROLLUP or GROUP BY CUBE.";
const GROUPING_EXPRESSION_ERROR =
  "Expected an unaliased SOQL GROUPING() expression.";

export function validateGroupingField(
  field: string,
  groupingFields: readonly string[],
): void {
  if (!groupingFields.includes(field)) {
    throw new TypeError(GROUPING_FIELD_ERROR);
  }
}

export function validateGroupingFunctionNode(
  node: OperationNode,
  groupingFields: readonly string[],
): asserts node is AggregateFunctionNode {
  if (
    node.kind !== "AggregateFunctionNode" ||
    (node as AggregateFunctionNode).function !== "grouping" ||
    !(node as AggregateFunctionNode).reference
  ) {
    throw new TypeError(GROUPING_EXPRESSION_ERROR);
  }

  validateGroupingField(
    (node as AggregateFunctionNode).reference?.name ?? "",
    groupingFields,
  );
}

export function parseGroupingFunctionExpression(
  expression: GroupingFunctionBuilder,
  groupingFields: readonly string[],
): AggregateFunctionNode {
  const node = expression.toOperationNode();

  validateGroupingFunctionNode(node, groupingFields);

  return node;
}

export function validateGroupingSelections(
  selections: readonly SelectionNode[],
  groupingFields: readonly string[],
): void {
  for (const selection of selections) {
    if (
      selection.selection.kind === "AliasNode" &&
      selection.selection.node.kind === "AggregateFunctionNode" &&
      (selection.selection.node as AggregateFunctionNode).function ===
        "grouping"
    ) {
      validateGroupingFunctionNode(selection.selection.node, groupingFields);
    }
  }
}
