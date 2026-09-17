export interface SalesforceField<
  Value,
  SalesforceType extends string,
  Nullable extends boolean,
  Filterable extends boolean,
  Sortable extends boolean,
  Groupable extends boolean,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
  ActivePicklistValue extends string = never,
> {
  readonly value: Value;
  readonly salesforceType: SalesforceType;
  readonly nullable: Nullable;
  readonly filterable: Filterable;
  readonly sortable: Sortable;
  readonly groupable: Groupable;
  readonly referenceTo: ReferenceTo;
  readonly relationshipName: RelationshipName;
  readonly activePicklistValue: ActivePicklistValue;
}

export interface SalesforceParentRelationship<
  ObjectName extends string,
  FieldName extends string,
  Nullable extends boolean,
> {
  readonly object: ObjectName;
  readonly field: FieldName;
  readonly nullable: Nullable;
}

export interface SalesforceChildRelationship<
  ObjectName extends string,
  FieldName extends string,
> {
  readonly object: ObjectName;
  readonly field: FieldName;
}

export interface SalesforceObject<
  Fields extends Record<
    string,
    SalesforceField<
      unknown,
      string,
      boolean,
      boolean,
      boolean,
      boolean,
      string,
      string,
      string
    >
  >,
  Parents extends Record<
    string,
    SalesforceParentRelationship<string, string, boolean>
  > = Record<never, never>,
  Children extends Record<
    string,
    SalesforceChildRelationship<string, string>
  > = Record<never, never>,
> {
  readonly fields: Fields;
  readonly parents: Parents;
  readonly children: Children;
}

export type SalesforceSchema = Record<
  string,
  SalesforceObject<
    Record<
      string,
      SalesforceField<
        unknown,
        string,
        boolean,
        boolean,
        boolean,
        boolean,
        string,
        string,
        string
      >
    >,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>
  >
>;

export type SalesforceFieldValue<Field> =
  Field extends SalesforceField<
    infer Value,
    string,
    infer Nullable,
    boolean,
    boolean,
    boolean,
    string,
    string,
    string
  >
    ? Nullable extends true
      ? Value | null
      : Value
    : never;

export type SalesforceRow<ObjectType> =
  ObjectType extends SalesforceObject<
    infer Fields,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>
  >
    ? {
        readonly [FieldName in keyof Fields]: SalesforceFieldValue<
          Fields[FieldName]
        >;
      }
    : never;
