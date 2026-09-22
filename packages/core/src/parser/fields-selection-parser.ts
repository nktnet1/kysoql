import type { AndNode } from "#/operation-node/and-node";
import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import type { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import {
  FieldsFunctionNode,
  type FieldsSelector,
} from "#/operation-node/fields-function-node";
import type { LimitNode } from "#/operation-node/limit-node";
import type { NotNode } from "#/operation-node/not-node";
import type { OperationNode } from "#/operation-node/operation-node";
import type { OperatorNode } from "#/operation-node/operator-node";
import type { OrNode } from "#/operation-node/or-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type { ValueListNode } from "#/operation-node/value-list-node";
import type { WhereNode } from "#/operation-node/where-node";
import type {
  FieldDefinition,
  FieldName,
  FieldsOf,
} from "#/parser/reference-parser";
import type { TraversesTypeOfRelationship } from "#/parser/type-of-parser";
import type {
  SalesforceFieldCustom,
  SalesforceFieldValue,
  SalesforceObjectFieldsComplete,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type FieldMatchesSelector<
  Field,
  Selector extends FieldsSelector,
> = Selector extends "all"
  ? true
  : Selector extends "custom"
    ? SalesforceFieldCustom<Field>
    : SalesforceFieldCustom<Field> extends false
      ? true
      : false;

export type FieldsSelection<
  DB,
  TB extends keyof DB,
  Selector extends FieldsSelector,
> = Simplify<{
  readonly [Field in FieldName<DB, TB> as true extends FieldMatchesSelector<
    FieldsOf<DB, TB>[Field],
    Selector
  >
    ? Field
    : never]: SalesforceFieldValue<FieldDefinition<DB, TB, Field>>;
}>;

type EmptyCustomSelectionCheck<
  DB,
  TB extends keyof DB,
  O,
  Selector extends FieldsSelector,
> = Selector extends "custom"
  ? [keyof FieldsSelection<DB, TB, Selector>] extends [never]
    ? [keyof O] extends [never]
      ? readonly [requiresExplicitSelection: never]
      : readonly []
    : readonly []
  : readonly [];

export type FieldsSelectionCheck<
  DB,
  TB extends keyof DB,
  O,
  Selector extends FieldsSelector,
> =
  false extends SalesforceObjectFieldsComplete<DB[TB]>
    ? readonly [requiresCompleteFieldSchema: never]
    : Extract<keyof O, keyof FieldsSelection<DB, TB, Selector>> extends never
      ? EmptyCustomSelectionCheck<DB, TB, O, Selector>
      : readonly [overlappingFields: never];

export type AvailableSelectExpression<
  DB,
  TB extends keyof DB,
  O,
  Selection extends string,
> =
  Extract<Selection, FieldName<DB, TB> & keyof O> extends never
    ? TraversesTypeOfRelationship<O, Selection> extends true
      ? never
      : unknown
    : never;

export function parseFieldsSelection(selector: FieldsSelector): SelectionNode {
  return SelectionNode.create(FieldsFunctionNode.create(selector));
}

const MAX_UNBOUNDED_FIELDS_ROWS = 200;
const UNBOUNDED_FIELDS_ERROR =
  "SOQL FIELDS(ALL) and FIELDS(CUSTOM) require LIMIT 200 or less or a WHERE Id filter bounded to 200 IDs or fewer.";
const APEX_UNBOUNDED_FIELDS_ERROR =
  "SOQL FIELDS(ALL) and FIELDS(CUSTOM) are not supported in Apex.";
const DUPLICATE_FIELDS_ERROR =
  "SOQL FIELDS() selections must not overlap or repeat.";

export interface FieldsSelectionValidationContext {
  readonly apex: boolean;
  readonly where: WhereNode | undefined;
}

export function validateFieldsSelections(
  selections: readonly SelectionNode[],
  limit: LimitNode<number | ApexBindExpressionNode> | undefined,
  context: FieldsSelectionValidationContext = {
    apex: false,
    where: undefined,
  },
): void {
  const selectors = selections.flatMap((selection) =>
    selection.selection.kind === "FieldsFunctionNode"
      ? [selection.selection.selector]
      : [],
  );

  if (
    new Set(selectors).size !== selectors.length ||
    (selectors.includes("all") &&
      (selectors.length > 1 ||
        selections.some(
          (selection) =>
            selection.selection.kind === "ReferenceNode" &&
            !selection.selection.name.includes("."),
        )))
  ) {
    throw new TypeError(DUPLICATE_FIELDS_ERROR);
  }

  const hasUnboundedFields =
    selectors.includes("all") || selectors.includes("custom");

  if (!hasUnboundedFields) {
    return;
  }

  if (context.apex) {
    throw new TypeError(APEX_UNBOUNDED_FIELDS_ERROR);
  }

  const literalLimit =
    limit && typeof limit.limit === "number" ? limit.limit : undefined;
  const boundedByLimit =
    literalLimit !== undefined && literalLimit <= MAX_UNBOUNDED_FIELDS_ROWS;
  const idBound = context.where
    ? getMaximumIdBound(context.where.where)
    : undefined;
  const idTestCount = context.where
    ? countDirectIdTests(context.where.where)
    : 0;
  const boundedById =
    idBound !== undefined &&
    idBound <= MAX_UNBOUNDED_FIELDS_ROWS &&
    idTestCount <= MAX_UNBOUNDED_FIELDS_ROWS;

  if (!boundedByLimit && !boundedById) {
    throw new RangeError(UNBOUNDED_FIELDS_ERROR);
  }
}

function getMaximumIdBound(node: OperationNode): number | undefined {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      const left = getMaximumIdBound(and.left);
      const right = getMaximumIdBound(and.right);

      if (left === undefined) {
        return right;
      }
      if (right === undefined) {
        return left;
      }

      return Math.min(left, right);
    }
    case "OrNode": {
      const or = node as OrNode;
      const left = getMaximumIdBound(or.left);
      const right = getMaximumIdBound(or.right);

      return left === undefined || right === undefined
        ? undefined
        : left + right;
    }
    case "BinaryOperationNode":
      return getBinaryIdBound(node as BinaryOperationNode);
    default:
      return undefined;
  }
}

function countDirectIdTests(node: OperationNode): number {
  switch (node.kind) {
    case "AndNode": {
      const and = node as AndNode;
      return countDirectIdTests(and.left) + countDirectIdTests(and.right);
    }
    case "OrNode": {
      const or = node as OrNode;
      return countDirectIdTests(or.left) + countDirectIdTests(or.right);
    }
    case "NotNode":
      return countDirectIdTests((node as NotNode).operand);
    case "BinaryOperationNode": {
      const bound = getBinaryIdBound(node as BinaryOperationNode);
      return bound ?? 0;
    }
    default:
      return 0;
  }
}

function getBinaryIdBound(node: BinaryOperationNode): number | undefined {
  if (
    node.leftOperand.kind !== "ReferenceNode" ||
    (node.leftOperand as ReferenceNode).name !== "Id" ||
    node.operator.kind !== "OperatorNode"
  ) {
    return undefined;
  }

  const operator = (node.operator as OperatorNode).operator;

  if (operator === "=" && node.rightOperand.kind === "ValueNode") {
    return 1;
  }

  if (operator === "in" && node.rightOperand.kind === "ValueListNode") {
    return (node.rightOperand as ValueListNode).values.length;
  }

  return undefined;
}
