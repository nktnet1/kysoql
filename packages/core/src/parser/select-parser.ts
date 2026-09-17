import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type { SalesforceFieldValue } from "#/schema";
import type { FieldDefinition, FieldName } from "#/parser/reference-parser";

export type SelectExpression<DB, TB extends keyof DB> = FieldName<DB, TB>;

export type SelectArg<
  DB,
  TB extends keyof DB,
  SE extends SelectExpression<DB, TB>,
> = SE | ReadonlyArray<SE>;

export type Selection<DB, TB extends keyof DB, SE> = {
  readonly [Field in Extract<SE, FieldName<DB, TB>>]: SalesforceFieldValue<
    FieldDefinition<DB, TB, Field>
  >;
};


export function parseSelectArg(selection: string | ReadonlyArray<string>) {
  const selections = Array.isArray(selection) ? selection : [selection];

  return selections.map((field) =>
    SelectionNode.create(ReferenceNode.create(field)),
  );
}
