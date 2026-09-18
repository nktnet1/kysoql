import type { AliasedSelectFunctionBuilder } from "#/expression/aggregate-function-builder";
import type { AliasNode } from "#/operation-node/alias-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { SelectionNode } from "#/operation-node/selection-node";

export type SelectFunctionSelectionExpression = AliasedSelectFunctionBuilder<
  unknown,
  string
>;

export type SelectFunctionSelectionArg =
  | SelectFunctionSelectionExpression
  | readonly SelectFunctionSelectionExpression[];

type SelectFunctionSelectionOutput<Selection> =
  Selection extends AliasedSelectFunctionBuilder<
    infer Output,
    infer Alias extends string
  >
    ? { readonly [Key in Alias]: Output }
    : never;

type UnionToIntersection<Union> = (
  Union extends unknown
    ? (value: Union) => void
    : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

export type SelectFunctionSelection<Selection> =
  Selection extends readonly (infer Item)[]
    ? UnionToIntersection<SelectFunctionSelectionOutput<Item>>
    : SelectFunctionSelectionOutput<Selection>;

const SELECT_FUNCTION_SELECTION_ERROR =
  "SOQL SELECT function expressions must be aliased.";
const EMPTY_SELECT_FUNCTION_SELECTION_ERROR =
  "SOQL SELECT function selection lists must contain at least one expression.";

function operationNodeOf(expression: unknown): OperationNode | undefined {
  if (
    typeof expression !== "object" ||
    expression === null ||
    !("toOperationNode" in expression) ||
    typeof expression.toOperationNode !== "function"
  ) {
    return undefined;
  }

  return expression.toOperationNode() as OperationNode;
}

function isSelectFunctionNode(node: OperationNode | undefined): boolean {
  return (
    node?.kind === "ConvertCurrencyFunctionNode" ||
    node?.kind === "FormatFunctionNode" ||
    node?.kind === "ToLabelFunctionNode"
  );
}

export function isSelectFunctionSelectionArg(selection: unknown): boolean {
  const expressions = Array.isArray(selection) ? selection : [selection];

  return expressions.some((expression) => {
    const node = operationNodeOf(expression);

    return (
      isSelectFunctionNode(node) ||
      (node?.kind === "AliasNode" &&
        isSelectFunctionNode((node as AliasNode).node))
    );
  });
}

function parseAliasedSelectFunctionNode(expression: unknown): AliasNode {
  const node = operationNodeOf(expression);

  if (
    node?.kind !== "AliasNode" ||
    !isSelectFunctionNode((node as AliasNode).node)
  ) {
    throw new TypeError(SELECT_FUNCTION_SELECTION_ERROR);
  }

  return node as AliasNode;
}

export function validateUniqueSelectFunctionAliases(
  existingSelections: readonly SelectionNode[],
  selections: readonly SelectionNode[],
): void {
  const aliases = new Set<string>();

  for (const selection of existingSelections) {
    if (selection.selection.kind === "AliasNode") {
      aliases.add(selection.selection.alias);
    }
  }

  for (const selection of selections) {
    if (selection.selection.kind !== "AliasNode") {
      continue;
    }

    if (aliases.has(selection.selection.alias)) {
      throw new TypeError(
        `Duplicate SOQL selection alias: ${selection.selection.alias}.`,
      );
    }

    aliases.add(selection.selection.alias);
  }
}

export function parseSelectFunctionSelectArg(
  selection: SelectFunctionSelectionArg,
): readonly SelectionNode[] {
  const selections = Array.isArray(selection) ? selection : [selection];

  if (selections.length === 0) {
    throw new TypeError(EMPTY_SELECT_FUNCTION_SELECTION_ERROR);
  }

  const aliases = new Set<string>();

  return selections.map((expression) => {
    const node = parseAliasedSelectFunctionNode(expression);

    if (aliases.has(node.alias)) {
      throw new TypeError(`Duplicate SOQL selection alias: ${node.alias}.`);
    }

    aliases.add(node.alias);
    return SelectionNode.create(node);
  });
}
