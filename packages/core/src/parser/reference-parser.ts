import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceParentRelationship,
} from "#/schema";
import type { NonNeverStringKey } from "#/util/type-utils";

export type FieldsOf<DB, TB extends keyof DB> = DB[TB] extends {
  readonly fields: infer Fields;
}
  ? Fields
  : never;

export type ParentsOf<DB, TB extends keyof DB> = DB[TB] extends {
  readonly parents: infer Parents;
}
  ? Parents
  : never;

export type ChildrenOf<DB, TB extends keyof DB> = DB[TB] extends {
  readonly children: infer Children;
}
  ? Children
  : never;

export type FieldName<DB, TB extends keyof DB> = NonNeverStringKey<
  FieldsOf<DB, TB>
>;

export type ParentRelationshipName<DB, TB extends keyof DB> = NonNeverStringKey<
  ParentsOf<DB, TB>
>;

export type ChildRelationshipName<DB, TB extends keyof DB> = NonNeverStringKey<
  ChildrenOf<DB, TB>
>;

export type FieldDefinition<
  DB,
  TB extends keyof DB,
  Field extends FieldName<DB, TB>,
> = FieldsOf<DB, TB>[Field];

export type ParentRelationshipDefinition<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> = ParentsOf<DB, TB>[Relationship];

export type ChildRelationshipDefinition<
  DB,
  TB extends keyof DB,
  Relationship extends ChildRelationshipName<DB, TB>,
> = ChildrenOf<DB, TB>[Relationship];

export type ParentObjectNameFromRelationship<Relationship> =
  Relationship extends SalesforceParentRelationship<
    infer ObjectName,
    string,
    boolean
  >
    ? ObjectName
    : never;

type ParentNullabilityFromRelationship<Relationship> =
  Relationship extends SalesforceParentRelationship<
    string,
    string,
    infer Nullable
  >
    ? Nullable
    : never;

type ChildObjectNameFromRelationship<Relationship> =
  Relationship extends SalesforceChildRelationship<infer ObjectName, string>
    ? ObjectName
    : never;

export type ParentRelationshipObjectName<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> = ParentObjectNameFromRelationship<
  ParentRelationshipDefinition<DB, TB, Relationship>
>;

export type ParentRelationshipFieldName<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> =
  ParentRelationshipDefinition<
    DB,
    TB,
    Relationship
  > extends SalesforceParentRelationship<string, infer FieldName, boolean>
    ? FieldName
    : never;

export type ParentObjectName<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> =
  ParentRelationshipObjectName<
    DB,
    TB,
    Relationship
  > extends infer ObjectName extends string
    ? [ObjectName] extends [keyof DB & string]
      ? ObjectName
      : never
    : never;

export type ParentRelationshipNullable<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> = ParentNullabilityFromRelationship<
  ParentRelationshipDefinition<DB, TB, Relationship>
>;

export type PolymorphicRelationshipTypeTargets<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> =
  ParentRelationshipFieldName<
    DB,
    TB,
    Relationship
  > extends infer SourceField extends FieldName<DB, TB>
    ? FieldDefinition<DB, TB, SourceField> extends {
        readonly polymorphic: true;
        readonly referenceTo: infer Targets extends string;
      }
      ? Targets
      : never
    : never;

type PolymorphicTypeQualifierDefinition<
  DB,
  TB extends keyof DB,
  Relationship extends ParentRelationshipName<DB, TB>,
> =
  PolymorphicRelationshipTypeTargets<
    DB,
    TB,
    Relationship
  > extends infer Targets extends string
    ? [Targets] extends [never]
      ? never
      : SalesforceField<
          Targets,
          "polymorphicType",
          ParentRelationshipNullable<DB, TB, Relationship>,
          true,
          false,
          false
        >
    : never;

export type ChildObjectName<
  DB,
  TB extends keyof DB,
  Relationship extends ChildRelationshipName<DB, TB>,
> =
  ChildObjectNameFromRelationship<
    ChildRelationshipDefinition<DB, TB, Relationship>
  > extends infer ObjectName extends string
    ? [ObjectName] extends [keyof DB & string]
      ? ObjectName
      : never
    : never;

export type ChildRelationshipReference<
  DB,
  TB extends keyof DB,
  Relationship extends string,
> =
  Relationship extends ChildRelationshipName<DB, TB>
    ? [ChildObjectName<DB, TB, Relationship>] extends [never]
      ? never
      : Relationship
    : never;

type NextRelationshipDepth<Depth extends readonly unknown[]> = readonly [
  ...Depth,
  unknown,
];

export type FieldReferenceDefinition<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Depth extends readonly unknown[] = readonly [],
> = Reference extends `${infer Relationship}.${infer ParentReference}`
  ? Depth["length"] extends 5
    ? never
    : Relationship extends ParentRelationshipName<DB, TB>
      ? ParentReference extends "Type"
        ? PolymorphicTypeQualifierDefinition<
            DB,
            TB,
            Relationship
          > extends infer TypeQualifier
          ? [TypeQualifier] extends [never]
            ? ParentObjectName<
                DB,
                TB,
                Relationship
              > extends infer ParentTB extends keyof DB
              ? FieldReferenceDefinition<
                  DB,
                  ParentTB,
                  ParentReference,
                  NextRelationshipDepth<Depth>
                >
              : never
            : TypeQualifier
          : never
        : ParentObjectName<DB, TB, Relationship> extends infer ParentTB extends
              keyof DB
          ? FieldReferenceDefinition<
              DB,
              ParentTB,
              ParentReference,
              NextRelationshipDepth<Depth>
            >
          : never
      : never
  : Reference extends FieldName<DB, TB>
    ? FieldDefinition<DB, TB, Reference>
    : never;

export type FieldReferenceNullable<
  DB,
  TB extends keyof DB,
  Reference extends string,
  Depth extends readonly unknown[] = readonly [],
> = Reference extends `${infer Relationship}.${infer ParentReference}`
  ? Depth["length"] extends 5
    ? never
    : Relationship extends ParentRelationshipName<DB, TB>
      ? true extends ParentRelationshipNullable<DB, TB, Relationship>
        ? true
        : ParentReference extends "Type"
          ? [PolymorphicRelationshipTypeTargets<DB, TB, Relationship>] extends [
              never,
            ]
            ? ParentObjectName<
                DB,
                TB,
                Relationship
              > extends infer ParentTB extends keyof DB
              ? FieldReferenceNullable<
                  DB,
                  ParentTB,
                  ParentReference,
                  NextRelationshipDepth<Depth>
                >
              : never
            : false
          : ParentObjectName<
                DB,
                TB,
                Relationship
              > extends infer ParentTB extends keyof DB
            ? FieldReferenceNullable<
                DB,
                ParentTB,
                ParentReference,
                NextRelationshipDepth<Depth>
              >
            : never
      : never
  : Reference extends FieldName<DB, TB>
    ? FieldDefinition<DB, TB, Reference> extends {
        readonly nullable: infer Nullable;
      }
      ? Nullable
      : never
    : never;

export type FieldReference<
  DB,
  TB extends keyof DB,
  Reference extends string,
> = Reference extends unknown
  ? [FieldReferenceDefinition<DB, TB, Reference>] extends [never]
    ? never
    : Reference
  : never;
