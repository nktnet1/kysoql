import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type {
  FieldDefinition,
  FieldName,
  FieldReference,
  ParentObjectName,
  ParentRelationshipName,
  ParentRelationshipNullable,
  PolymorphicRelationshipTypeTargets,
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

type ParentSelectionReference<
  SE,
  Relationship extends string,
> = SE extends `${Relationship}.${infer Reference}` ? Reference : never;

type PolymorphicTypeSelection<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
  Reference,
> = PolymorphicRelationshipTypeTargets<
  DB,
  TB,
  Relationship
> extends infer Targets extends string
  ? [Targets] extends [never]
    ? unknown
    : "Type" extends Reference
      ? { readonly Type: Targets }
      : unknown
  : unknown;

type RegularParentSelectionReference<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
  Reference,
> = [PolymorphicRelationshipTypeTargets<DB, TB, Relationship>] extends [never]
  ? Reference
  : Exclude<Reference, "Type">;

type RegularParentSelection<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
  Reference,
  ForceNullable extends boolean,
> = RegularParentSelectionReference<
  DB,
  TB,
  Relationship,
  Reference
> extends infer RegularReference
  ? [RegularReference] extends [never]
    ? unknown
    : ParentObjectName<DB, TB, Relationship> extends infer ParentTB extends
          keyof DB
      ? Selection<DB, ParentTB, RegularReference, ForceNullable>
      : never
  : never;

type ParentSelectionValue<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
  Reference,
  ForceNullable extends boolean,
> = Simplify<
  PolymorphicTypeSelection<DB, TB, Relationship, Reference> &
    RegularParentSelection<DB, TB, Relationship, Reference, ForceNullable>
>;

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
  >]: true extends ParentRelationshipNullable<DB, TB, Relationship>
    ? ParentSelectionValue<
        DB,
        TB,
        Relationship,
        ParentSelectionReference<SE, Relationship>,
        ForceNullable
      > | null
    : ParentSelectionValue<
        DB,
        TB,
        Relationship,
        ParentSelectionReference<SE, Relationship>,
        ForceNullable
      >;
};

export type Selection<
  DB,
  TB extends keyof DB,
  SE,
  ForceNullable extends boolean = false,
> = Simplify<
  {
    readonly [Field in Extract<
      SE,
      FieldName<DB, TB>
    >]: ForceNullable extends true
      ? SalesforceFieldValue<FieldDefinition<DB, TB, Field>> | null
      : SalesforceFieldValue<FieldDefinition<DB, TB, Field>>;
  } & ParentSelection<DB, TB, SE, ForceNullable>
>;

export function parseSelectArg(selection: string | ReadonlyArray<string>) {
  const selections = Array.isArray(selection) ? selection : [selection];

  return selections.map((field) =>
    SelectionNode.create(ReferenceNode.create(field)),
  );
}
