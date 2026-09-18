import type {
  AliasedDateFunctionBuilder,
  DateFunctionBuilder,
  DateFunctionExpression,
} from "#/expression/aggregate-function-builder";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { ComparisonOperator } from "#/operation-node/operator-node";
import type { SelectionNode } from "#/operation-node/selection-node";

const DATE_GROUP_BY_EXPRESSION_ERROR =
  "SOQL date GROUP BY callbacks must return an unaliased date function expression.";
const DATE_FUNCTION_GROUP_ERROR =
  "SOQL date function expressions must also appear in GROUP BY.";

export type AnyDateFunctionBuilder = DateFunctionBuilder<
  unknown,
  unknown,
  ComparisonOperator,
  string
>;

export type AnyDateFunctionExpression = DateFunctionExpression<
  unknown,
  unknown,
  ComparisonOperator,
  string
>;

export type AnyAliasedDateFunctionBuilder = AliasedDateFunctionBuilder<
  unknown,
  string,
  string
>;

export function dateFunctionIdentity(node: DateFunctionNode): string {
  return `${node.function}(${node.reference.name})`;
}

export function parseDateGroupByExpression(
  expression: AnyDateFunctionBuilder,
): DateFunctionNode {
  const node = expression.toOperationNode();

  if (node.kind !== "DateFunctionNode") {
    throw new TypeError(DATE_GROUP_BY_EXPRESSION_ERROR);
  }

  return node;
}

export function validateGroupedDateFunctionNode(
  node: OperationNode,
  groupedBy: readonly string[],
): asserts node is DateFunctionNode {
  if (
    node.kind !== "DateFunctionNode" ||
    !groupedBy.includes(dateFunctionIdentity(node as DateFunctionNode))
  ) {
    throw new TypeError(DATE_FUNCTION_GROUP_ERROR);
  }
}

export function validateDateFunctionSelections(
  selections: readonly SelectionNode[],
  groupedBy: readonly string[],
): void {
  for (const selection of selections) {
    if (
      selection.selection.kind === "AliasNode" &&
      selection.selection.node.kind === "DateFunctionNode"
    ) {
      validateGroupedDateFunctionNode(selection.selection.node, groupedBy);
    }
  }
}
