import { ReferenceNode } from "../operation-node/reference-node.js";
import { SelectionNode } from "../operation-node/selection-node.js";
import type { SalesforceFieldValue } from "../schema.js";
import type { FieldDefinition, FieldName } from "./reference-parser.js";

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
