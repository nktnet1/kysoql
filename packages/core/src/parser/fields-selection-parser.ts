import type { ApexBindExpressionNode } from "#/operation-node/apex-expression-node";
import {
  FieldsFunctionNode,
  type FieldsSelector,
} from "#/operation-node/fields-function-node";
import type { LimitNode } from "#/operation-node/limit-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type {
  FieldDefinition,
  FieldName,
  FieldsOf,
} from "#/parser/reference-parser";
import type { TraversesTypeOfRelationship } from "#/parser/type-of-parser";
import type { SalesforceFieldCustom, SalesforceFieldValue } from "#/schema";
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

export type FieldsSelectionCheck<
  DB,
  TB extends keyof DB,
  O,
  Selector extends FieldsSelector,
> =
  Extract<keyof O, keyof FieldsSelection<DB, TB, Selector>> extends never
    ? readonly []
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

const UNBOUNDED_FIELDS_ERROR =
  "SOQL FIELDS(ALL) and FIELDS(CUSTOM) require LIMIT 200 or less.";
const DUPLICATE_FIELDS_ERROR =
  "SOQL FIELDS() selections must not overlap or repeat.";

export function validateFieldsSelections(
  selections: readonly SelectionNode[],
  limit: LimitNode<number | ApexBindExpressionNode> | undefined,
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

  const literalLimit =
    limit && typeof limit.limit === "number" ? limit.limit : undefined;

  if (
    (selectors.includes("all") || selectors.includes("custom")) &&
    (literalLimit === undefined || literalLimit > 200)
  ) {
    throw new RangeError(UNBOUNDED_FIELDS_ERROR);
  }
}
