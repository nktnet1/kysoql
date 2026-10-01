import type { AliasedSelectFunctionBuilder } from "#src/expression/aggregate-function-builder";
import type { AliasedDistanceFunctionBuilder } from "#src/expression/geolocation-function-builder";
import type { AliasNode } from "#src/operation-node/alias-node";
import type { FormatFunctionNode } from "#src/operation-node/format-function-node";
import type { OperationNode } from "#src/operation-node/operation-node";
import { SelectionNode } from "#src/operation-node/selection-node";

export type SelectFunctionSelectionExpression =
  | AliasedSelectFunctionBuilder<unknown, string>
  | AliasedDistanceFunctionBuilder<unknown, string>;

export type SelectFunctionSelectionArg =
  | SelectFunctionSelectionExpression
  | readonly SelectFunctionSelectionExpression[];

type SelectFunctionSelectionOutput<Selection> = Selection extends
  | AliasedSelectFunctionBuilder<infer Output, infer Alias extends string>
  | AliasedDistanceFunctionBuilder<infer Output, infer Alias extends string>
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
  if (node?.kind === "FormatFunctionNode") {
    return (
      (node as FormatFunctionNode).expression.kind !== "AggregateFunctionNode"
    );
  }

  return (
    node?.kind === "ConvertCurrencyFunctionNode" ||
    node?.kind === "DistanceFunctionNode" ||
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

function unaliasedSelectionOutputProperty(
  selection: SelectionNode,
): string | undefined {
  const node = selection.selection;

  if (node.kind === "ReferenceNode") {
    return node.name.split(".")[0];
  }
  if (node.kind === "RelationshipSubqueryNode") {
    return node.relationship.name;
  }
  if (node.kind === "TypeOfNode") {
    return node.reference.name.split(".")[0];
  }

  return undefined;
}

export function validateUniqueSelectionAliases(
  existingSelections: readonly SelectionNode[],
  selections: readonly SelectionNode[],
): void {
  const aliases = new Set<string>();
  const properties = new Set<string>();

  for (const selection of [...existingSelections, ...selections]) {
    const node = selection.selection;

    if (node.kind === "AliasNode") {
      if (aliases.has(node.alias)) {
        throw new TypeError(`Duplicate SOQL selection alias: ${node.alias}.`);
      }
      if (properties.has(node.alias)) {
        throw new TypeError(
          `SOQL selection alias ${node.alias} conflicts with a selected output property.`,
        );
      }

      aliases.add(node.alias);
      continue;
    }

    const property = unaliasedSelectionOutputProperty(selection);
    if (property !== undefined) {
      if (aliases.has(property)) {
        throw new TypeError(
          `SOQL selection alias ${property} conflicts with a selected output property.`,
        );
      }
      properties.add(property);
    }
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
