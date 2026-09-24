import type { SoqlRelativeDateLiteral } from "#/soql-relative-date-literal";
import type {
  SoqlDateLiteral,
  SoqlDateTimeLiteral,
  SoqlTimeLiteral,
} from "#/soql-temporal-literal";
import type { NonNeverStringKey } from "#/util/type-utils";

export interface SalesforceFieldMetadata {
  readonly salesforceType: string;
  readonly nullable: boolean;
  readonly filterable: boolean;
  readonly sortable: boolean;
  readonly groupable: boolean;
  readonly referenceTo?: string;
  readonly relationshipName?: string;
  readonly activePicklistValue?: string;
  readonly aggregatable?: boolean;
  readonly custom?: boolean;
  readonly polymorphic?: boolean;
}

type SalesforceFieldMetadataProperty<
  Metadata,
  Key extends PropertyKey,
  Default,
> = Key extends keyof Metadata ? Exclude<Metadata[Key], undefined> : Default;

type SalesforceFieldShape<Value, Metadata extends SalesforceFieldMetadata> = {
  readonly value: Value;
  readonly salesforceType: Metadata["salesforceType"];
  readonly nullable: Metadata["nullable"];
  readonly filterable: Metadata["filterable"];
  readonly sortable: Metadata["sortable"];
  readonly groupable: Metadata["groupable"];
  readonly referenceTo: SalesforceFieldMetadataProperty<
    Metadata,
    "referenceTo",
    never
  >;
  readonly relationshipName: SalesforceFieldMetadataProperty<
    Metadata,
    "relationshipName",
    never
  >;
  readonly activePicklistValue: SalesforceFieldMetadataProperty<
    Metadata,
    "activePicklistValue",
    never
  >;
  readonly aggregatable: SalesforceFieldMetadataProperty<
    Metadata,
    "aggregatable",
    false
  >;
  readonly custom: SalesforceFieldMetadataProperty<Metadata, "custom", false>;
  readonly polymorphic: SalesforceFieldMetadataProperty<
    Metadata,
    "polymorphic",
    false
  >;
};

/**
 * Describes one Salesforce field.
 *
 * Generated schemas use the named metadata-object form. The remaining generic
 * parameters preserve compatibility with hand-written schemas that used the
 * original positional representation before named metadata was introduced.
 */
export type SalesforceField<
  Value,
  MetadataOrSalesforceType extends SalesforceFieldMetadata | string,
  Nullable extends boolean = false,
  Filterable extends boolean = false,
  Sortable extends boolean = false,
  Groupable extends boolean = false,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
  ActivePicklistValue extends string = never,
  Aggregatable extends boolean = false,
  Custom extends boolean = false,
  Polymorphic extends boolean = false,
> = SalesforceFieldShape<
  Value,
  MetadataOrSalesforceType extends SalesforceFieldMetadata
    ? MetadataOrSalesforceType
    : {
        readonly salesforceType: MetadataOrSalesforceType;
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
>;

type AnySalesforceField = SalesforceField<unknown, SalesforceFieldMetadata>;

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

export type SalesforceSetOptionsCapability =
  | "none"
  | "data360-dlo"
  | "data360-dmo";

export interface SalesforceObject<
  Fields extends Record<string, AnySalesforceField>,
  Parents extends Record<
    string,
    SalesforceParentRelationship<string, string, boolean>
  > = Record<string, never>,
  Children extends Record<
    string,
    SalesforceChildRelationship<string, string>
  > = Record<string, never>,
  SupportedScope extends string = never,
  DataCategoryGroups extends Record<string, string> = Record<string, never>,
  MruEnabled extends boolean = boolean,
  SetOptionsCapability extends SalesforceSetOptionsCapability = "none",
  FieldsComplete extends boolean = true,
> {
  readonly fields: Fields;
  readonly parents: Parents;
  readonly children: Children;
  readonly supportedScopes: SupportedScope;
  readonly dataCategoryGroups: DataCategoryGroups;
  readonly mruEnabled: MruEnabled;
  readonly setOptionsCapability: SetOptionsCapability;
  /** False for field-filtered schemas; server-side FIELDS() cannot be narrowed. */
  readonly fieldsComplete?: FieldsComplete;
}

export interface SalesforceSchemaMetadata {
  readonly bigObjectIndexes?: Readonly<Record<string, readonly string[]>>;
  readonly data360StringFields?: Readonly<Record<string, readonly string[]>>;
  readonly data360LookupFields?: Readonly<Record<string, readonly string[]>>;
}

export type SalesforceSchema = Record<
  string,
  SalesforceObject<
    Record<string, AnySalesforceField>,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>,
    string,
    Record<string, string>,
    boolean,
    SalesforceSetOptionsCapability,
    boolean
  >
>;

/** Legacy structural schemas without this metadata retain their old behaviour. */
export type SalesforceObjectFieldsComplete<ObjectType> = ObjectType extends {
  readonly fieldsComplete?: infer Complete extends boolean;
}
  ? Complete
  : true;

export type SalesforceObjectDataCategoryGroup<ObjectType> = ObjectType extends {
  readonly dataCategoryGroups: infer Groups;
}
  ? NonNeverStringKey<Groups>
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

export type SalesforceObjectMruEnabled<ObjectType> = ObjectType extends {
  readonly mruEnabled: infer MruEnabled extends boolean;
}
  ? MruEnabled
  : boolean;

export type SalesforceObjectSupportedScope<ObjectType> = ObjectType extends {
  readonly supportedScopes: infer SupportedScope extends string;
}
  ? SupportedScope
  : never;

export type SalesforceObjectSetOptionsCapability<ObjectType> =
  ObjectType extends {
    readonly setOptionsCapability: infer Capability extends
      SalesforceSetOptionsCapability;
  }
    ? Capability
    : "none";

export type SalesforceFieldValue<Field> = Field extends {
  readonly value: infer Value;
  readonly nullable: infer Nullable extends boolean;
}
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

export type SalesforceFieldFilterValue<Field> = Field extends {
  readonly value: infer Value;
  readonly salesforceType: infer SalesforceType extends string;
  readonly nullable: infer Nullable extends boolean;
}
  ? Nullable extends true
    ? SalesforceFieldFilterScalar<Value, SalesforceType> | null
    : SalesforceFieldFilterScalar<Value, SalesforceType>
  : never;

export type SalesforceFieldCustom<Field> = Field extends {
  readonly custom: infer Custom extends boolean;
}
  ? Custom
  : never;

export type SalesforceRow<ObjectType> =
  ObjectType extends SalesforceObject<
    infer Fields,
    Record<string, SalesforceParentRelationship<string, string, boolean>>,
    Record<string, SalesforceChildRelationship<string, string>>,
    string,
    Record<string, string>,
    boolean,
    SalesforceSetOptionsCapability,
    boolean
  >
    ? {
        readonly [FieldName in keyof Fields]: SalesforceFieldValue<
          Fields[FieldName]
        >;
      }
    : never;
