import type {
  AliasedDateFunctionBuilder,
  DateFunctionBuilder,
  DateFunctionExpression,
} from "#src/expression/aggregate-function-builder";
import type { DateFunctionNode } from "#src/operation-node/date-function-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import type { ComparisonOperator } from "#src/operation-node/operator-node";
import type { SelectionNode } from "#src/operation-node/selection-node";

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
  const argument =
    node.reference.kind === "ReferenceNode"
      ? node.reference.name
      : `convertTimezone(${node.reference.reference.name})`;

  return `${node.function}(${argument})`;
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
  allowGroupedDateField = false,
): void {
  for (const selection of selections) {
    const aliasedNode = selection.selection;
    if (aliasedNode.kind !== "AliasNode") {
      continue;
    }

    if (aliasedNode.node.kind !== "DateFunctionNode") {
      continue;
    }

    const node = aliasedNode.node as DateFunctionNode;
    if (groupedBy.includes(dateFunctionIdentity(node))) {
      continue;
    }

    if (
      allowGroupedDateField &&
      node.reference.kind === "ReferenceNode" &&
      groupedBy.includes(node.reference.name)
    ) {
      continue;
    }

    throw new TypeError(DATE_FUNCTION_GROUP_ERROR);
  }
}
