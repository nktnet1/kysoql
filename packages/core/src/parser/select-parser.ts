import { AliasNode } from "#/operation-node/alias-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectionNode } from "#/operation-node/selection-node";
import type {
  FieldDefinition,
  FieldName,
  FieldReference,
  FieldReferenceDefinition,
  FieldReferenceNullable,
  ParentObjectName,
  ParentRelationshipName,
  ParentRelationshipNullable,
  PolymorphicRelationshipTypeTargets,
} from "#/parser/reference-parser";
import { parseSelectionAlias } from "#/parser/selection-alias-parser";
import type { SalesforceFieldValue } from "#/schema";
import type { Simplify } from "#/util/type-utils";

export type SelectionReference<Selection extends string> =
  Selection extends `${infer Reference} as ${string}` ? Reference : Selection;

export type SelectionAlias<Selection extends string> =
  Selection extends `${string} as ${infer Alias}` ? Alias : never;

export type SelectExpression<
  DB,
  TB extends keyof DB,
  SE extends string,
> = SE extends `${infer Reference} as ${infer Alias}`
  ? Alias extends ""
    ? never
    : Alias extends `${string} as ${string}`
      ? never
      : Reference extends FieldReference<DB, TB, Reference>
        ? SE
        : never
  : FieldReference<DB, TB, SE>;

export type SelectArg<DB, TB extends keyof DB, SE extends string> =
  | (SE & SelectExpression<DB, TB, SE>)
  | ReadonlyArray<SE & SelectExpression<DB, TB, SE>>;

type UnaliasedSelectionExpression<SE> = Exclude<SE, `${string} as ${string}`>;

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
> =
  PolymorphicRelationshipTypeTargets<
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
> =
  RegularParentSelectionReference<
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

type AliasedSelectionValue<
  DB,
  TB extends keyof DB,
  Reference extends string,
  ForceNullable extends boolean,
> =
  SalesforceFieldValue<
    FieldReferenceDefinition<DB, TB, Reference>
  > extends infer Value
    ? ForceNullable extends true
      ? Value | null
      : true extends FieldReferenceNullable<DB, TB, Reference>
        ? Value | null
        : Value
    : never;

type AliasedSelection<
  DB,
  TB extends keyof DB,
  SE,
  ForceNullable extends boolean,
> = {
  readonly [Expression in Extract<
    SE,
    `${string} as ${string}`
  > as SelectionAlias<Expression>]: AliasedSelectionValue<
    DB,
    TB,
    SelectionReference<Expression>,
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
      UnaliasedSelectionExpression<SE>,
      FieldName<DB, TB>
    >]: ForceNullable extends true
      ? SalesforceFieldValue<FieldDefinition<DB, TB, Field>> | null
      : SalesforceFieldValue<FieldDefinition<DB, TB, Field>>;
  } & ParentSelection<DB, TB, UnaliasedSelectionExpression<SE>, ForceNullable> &
    AliasedSelection<DB, TB, SE, ForceNullable>
>;

function parseSelectExpression(selection: string): SelectionNode {
  const aliasSeparatorIndex = selection.indexOf(" as ");

  if (aliasSeparatorIndex === -1) {
    return SelectionNode.create(ReferenceNode.create(selection));
  }

  const reference = selection.slice(0, aliasSeparatorIndex);
  const alias = selection.slice(aliasSeparatorIndex + 4);

  return SelectionNode.create(
    AliasNode.create(
      ReferenceNode.create(reference),
      parseSelectionAlias(alias),
    ),
  );
}

export function parseSelectArg(selection: string | ReadonlyArray<string>) {
  const selections = Array.isArray(selection) ? selection : [selection];

  return selections.map(parseSelectExpression);
}
