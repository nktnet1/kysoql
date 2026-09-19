import type { SoqlRelativeDateLiteral } from "#/soql-relative-date-literal";
import type {
  SoqlDateLiteral,
  SoqlDateTimeLiteral,
  SoqlTimeLiteral,
} from "#/soql-temporal-literal";

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
  Aggregatable extends boolean = false,
  Custom extends boolean = false,
  Polymorphic extends boolean = false,
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
  readonly aggregatable: Aggregatable;
  readonly custom: Custom;
  readonly polymorphic: Polymorphic;
}

type AnySalesforceField = SalesforceField<
  unknown,
  string,
  boolean,
  boolean,
  boolean,
  boolean,
  string,
  string,
  string,
  boolean,
  boolean,
  boolean
>;

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

export interface SalesforceGeolocation {
  readonly latitude: number;
  readonly longitude: number;
}

export interface SalesforceRecordAttributes<
  ObjectName extends string = string,
> {
  readonly type: ObjectName;
  readonly url: string;
}

export interface SalesforceQueryResult<Row> {
  readonly totalSize: number;
  readonly done: boolean;
  readonly records: readonly Row[];
  readonly nextRecordsUrl?: string;
}

export interface SalesforceObject<
  Fields extends Record<string, AnySalesforceField>,
  Parents extends Record<
    string,
    SalesforceParentRelationship<string, string, boolean>
  > = Record<never, never>,
  Children extends Record<
    string,
    SalesforceChildRelationship<string, string>
  > = Record<never, never>,
  SupportedScope extends string = never,
  DataCategoryGroups extends Record<string, string> = Record<never, never>,
> {
  readonly fields: Fields;
  readonly parents: Parents;
  readonly children: Children;
  readonly supportedScopes: SupportedScope;
  readonly dataCategoryGroups: DataCategoryGroups;
}

export type SalesforceSchema = Record<
  string,
  SalesforceObject<
    Record<string, AnySalesforceField>,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>,
    string,
    Record<string, string>
  >
>;

export type SalesforceObjectDataCategoryGroup<ObjectType> =
  ObjectType extends {
    readonly dataCategoryGroups: infer Groups;
  }
    ? keyof Groups & string
    : never;

export type SalesforceObjectDataCategory<
  ObjectType,
  Group extends SalesforceObjectDataCategoryGroup<ObjectType>,
> = ObjectType extends {
  readonly dataCategoryGroups: infer Groups;
}
  ? Group extends keyof Groups
    ? Groups[Group] extends string
      ? Groups[Group]
      : never
    : never
  : never;

export type SalesforceObjectSupportedScope<ObjectType> =
  ObjectType extends {
    readonly supportedScopes: infer SupportedScope extends string;
  }
    ? SupportedScope
    : never;

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
    string,
    boolean,
    boolean,
    boolean
  >
    ? Nullable extends true
      ? Value | null
      : Value
    : never;

type SalesforceFieldFilterScalar<
  Value,
  SalesforceType extends string,
> = SalesforceType extends "date"
  ? SoqlDateLiteral | SoqlRelativeDateLiteral
  : SalesforceType extends "datetime"
    ? SoqlDateTimeLiteral | SoqlRelativeDateLiteral
    : SalesforceType extends "time"
      ? SoqlTimeLiteral
      : Value;

export type SalesforceFieldFilterValue<Field> =
  Field extends SalesforceField<
    infer Value,
    infer SalesforceType,
    infer Nullable,
    boolean,
    boolean,
    boolean,
    string,
    string,
    string,
    boolean,
    boolean,
    boolean
  >
    ? Nullable extends true
      ? SalesforceFieldFilterScalar<Value, SalesforceType> | null
      : SalesforceFieldFilterScalar<Value, SalesforceType>
    : never;

export type SalesforceFieldCustom<Field> =
  Field extends SalesforceField<
    unknown,
    string,
    boolean,
    boolean,
    boolean,
    boolean,
    string,
    string,
    string,
    boolean,
    infer Custom,
    boolean
  >
    ? Custom
    : never;

export type SalesforceRow<ObjectType> =
  ObjectType extends SalesforceObject<
    infer Fields,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>,
    string,
    Record<string, string>
  >
    ? {
        readonly [FieldName in keyof Fields]: SalesforceFieldValue<
          Fields[FieldName]
        >;
      }
    : never;
