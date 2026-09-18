import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type {
  FieldDefinition,
  FieldName,
  FieldReference,
  ParentObjectName,
  ParentRelationshipName,
  ParentRelationshipNullable,
} from "#/parser/reference-parser";
import type { SalesforceFieldValue } from "#/schema";
import type { Simplify } from "#/util/type-utils";

export type SelectExpression<
  DB,
  TB extends keyof DB,
  SE extends string,
> = FieldReference<DB, TB, SE>;

export type SelectArg<DB, TB extends keyof DB, SE extends string> =
  | (SE & SelectExpression<DB, TB, SE>)
  | ReadonlyArray<SE & SelectExpression<DB, TB, SE>>;

type SelectedParentRelationshipName<
  DB,
  TB extends keyof DB,
  SE,
> = SE extends `${infer Relationship}.${string}`
  ? Relationship extends ParentRelationshipName<DB, TB>
    ? Relationship
    : never
  : never;

type ParentSelectionReference<SE, Relationship extends string> =
  SE extends `${Relationship}.${infer Reference}` ? Reference : never;

type ParentSelection<
  DB,
  TB extends keyof DB,
  SE,
  ForceNullable extends boolean,
> = {
  readonly [Relationship in SelectedParentRelationshipName<
    DB,
    TB,
    SE
  >]: ParentObjectName<DB, TB, Relationship> extends infer ParentTB extends keyof DB
    ? true extends ParentRelationshipNullable<DB, TB, Relationship>
      ? Selection<
          DB,
          ParentTB,
          ParentSelectionReference<SE, Relationship>,
          ForceNullable
        > | null
      : Selection<
          DB,
          ParentTB,
          ParentSelectionReference<SE, Relationship>,
          ForceNullable
        >
    : never;
};

export type Selection<
  DB,
  TB extends keyof DB,
  SE,
  ForceNullable extends boolean = false,
> = Simplify<
  {
    readonly [Field in Extract<SE, FieldName<DB, TB>>]: ForceNullable extends true
      ? SalesforceFieldValue<FieldDefinition<DB, TB, Field>> | null
      : SalesforceFieldValue<FieldDefinition<DB, TB, Field>>;
  } &
    ParentSelection<DB, TB, SE, ForceNullable>
>;

export function parseSelectArg(selection: string | ReadonlyArray<string>) {
  const selections = Array.isArray(selection) ? selection : [selection];

  return selections.map((field) =>
    SelectionNode.create(ReferenceNode.create(field)),
  );
}
