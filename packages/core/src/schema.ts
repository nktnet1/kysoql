import type { SoqlRelativeDateLiteral } from "#src/soql-relative-date-literal";
import type {
  SoqlDateLiteral,
  SoqlDateTimeLiteral,
  SoqlTimeLiteral,
} from "#src/soql-temporal-literal";
import type { NonNeverStringKey } from "#src/util/type-utils";

/**
 * Metadata that describes Salesforce field capabilities in a Kysoql schema.
 */
export interface SalesforceFieldMetadata {
  /** Salesforce Describe field type, such as `string`, `date`, or `reference`. */
  readonly salesforceType: string;
  /** Whether Salesforce can return `null` for this field. */
  readonly nullable: boolean;
  /** Whether the field can be referenced in a `WHERE` predicate. */
  readonly filterable: boolean;
  /** Whether the field can be referenced in `ORDER BY`. */
  readonly sortable: boolean;
  /** Whether the field can be referenced in `GROUP BY`. */
  readonly groupable: boolean;
  /** Referenced Salesforce object name for a relationship field, when known. */
  readonly referenceTo?: string;
  /** Parent relationship name used for dotted relationship traversal. */
  readonly relationshipName?: string;
  /** Active picklist values represented by the generated field type. */
  readonly activePicklistValue?: string;
  /** Whether the field can be passed to Salesforce aggregate functions. */
  readonly aggregatable?: boolean;
  /** Whether the field is a custom Salesforce field. */
  readonly custom?: boolean;
  /** Whether the relationship can target more than one Salesforce object type. */
  readonly polymorphic?: boolean;
}

type SalesforceFieldMetadataProperty<
  Metadata,
  Key extends PropertyKey,
  Default,
> = Key extends keyof Metadata ? Exclude<Metadata[Key], undefined> : Default;

type SalesforceFieldShape<Value, Metadata extends SalesforceFieldMetadata> = {
  /** Runtime value type returned for this field. */
  readonly value: Value;
  /** Salesforce Describe field type. */
  readonly salesforceType: Metadata["salesforceType"];
  /** Whether selected values may be `null`. */
  readonly nullable: Metadata["nullable"];
  /** Whether the field may be used in `WHERE`. */
  readonly filterable: Metadata["filterable"];
  /** Whether the field may be used in `ORDER BY`. */
  readonly sortable: Metadata["sortable"];
  /** Whether the field may be used in `GROUP BY`. */
  readonly groupable: Metadata["groupable"];
  /** Referenced object name, or `never` for non-reference fields. */
  readonly referenceTo: SalesforceFieldMetadataProperty<
    Metadata,
    "referenceTo",
    never
  >;
  /** Parent relationship name, or `never` when none exists. */
  readonly relationshipName: SalesforceFieldMetadataProperty<
    Metadata,
    "relationshipName",
    never
  >;
  /** Active picklist value union, or `never` for non-picklist fields. */
  readonly activePicklistValue: SalesforceFieldMetadataProperty<
    Metadata,
    "activePicklistValue",
    never
  >;
  /** Whether Salesforce allows aggregate functions on this field. */
  readonly aggregatable: SalesforceFieldMetadataProperty<
    Metadata,
    "aggregatable",
    false
  >;
  /** Whether this is a custom Salesforce field. */
  readonly custom: SalesforceFieldMetadataProperty<Metadata, "custom", false>;
  /** Whether the reference may target multiple Salesforce object types. */
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
        /** Salesforce Describe field type from the positional schema form. */
        readonly salesforceType: MetadataOrSalesforceType;
        /** Whether the positional schema field may be null. */
        readonly nullable: Nullable;
        /** Whether the positional schema field may be filtered. */
        readonly filterable: Filterable;
        /** Whether the positional schema field may be sorted. */
        readonly sortable: Sortable;
        /** Whether the positional schema field may be grouped. */
        readonly groupable: Groupable;
        /** Referenced object name in the positional schema form. */
        readonly referenceTo: ReferenceTo;
        /** Parent relationship name in the positional schema form. */
        readonly relationshipName: RelationshipName;
        /** Active picklist value union in the positional schema form. */
        readonly activePicklistValue: ActivePicklistValue;
        /** Whether the positional schema field supports aggregation. */
        readonly aggregatable: Aggregatable;
        /** Whether the positional schema field is custom. */
        readonly custom: Custom;
        /** Whether the positional schema relationship is polymorphic. */
        readonly polymorphic: Polymorphic;
      }
>;

type AnySalesforceField = SalesforceField<unknown, SalesforceFieldMetadata>;

/** Metadata for a Salesforce parent relationship reference. */
export interface SalesforceParentRelationship<
  ObjectName extends string,
  FieldName extends string,
  Nullable extends boolean,
> {
  /** API name of the parent Salesforce object. */
  readonly object: ObjectName;
  /** Foreign-key field that backs the parent relationship. */
  readonly field: FieldName;
  /** Whether the relationship can be absent on a returned record. */
  readonly nullable: Nullable;
}

/** Metadata for a Salesforce child relationship reference. */
export interface SalesforceChildRelationship<
  ObjectName extends string,
  FieldName extends string,
> {
  /** API name of the child Salesforce object. */
  readonly object: ObjectName;
  /** Child foreign-key field that points back to the parent object. */
  readonly field: FieldName;
}

/** Latitude and longitude value used by Salesforce geolocation fields. */
export interface SalesforceGeolocation {
  /** Latitude in decimal degrees. */
  readonly latitude: number;
  /** Longitude in decimal degrees. */
  readonly longitude: number;
}

/**
 * Standard Salesforce record attributes returned by REST query responses.
 */
export interface SalesforceRecordAttributes<
  ObjectName extends string = string,
> {
  /** Salesforce object API name for the returned record. */
  readonly type: ObjectName;
  /** REST resource URL for the returned record. */
  readonly url: string;
}

/** Paginated Salesforce query response shape. */
export interface SalesforceQueryResult<Row> {
  /** Total number of records matching the query before pagination. */
  readonly totalSize: number;
  /** Whether Salesforce has returned the final query page. */
  readonly done: boolean;
  /** Records contained in this query page. */
  readonly records: readonly Row[];
  /** Relative REST URL for the next page when `done` is false. */
  readonly nextRecordsUrl?: string;
}

/**
 * SET OPTIONS capability recorded for a generated Salesforce object schema.
 */
export type SalesforceSetOptionsCapability =
  | "none"
  | "data360-dlo"
  | "data360-dmo";

/**
 * Type-level description of one Salesforce object and its query
 * capabilities.
 */
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
  /** Field definitions keyed by Salesforce field API name. */
  readonly fields: Fields;
  /** Parent relationship definitions keyed by relationship name. */
  readonly parents: Parents;
  /** Child relationship definitions keyed by relationship name. */
  readonly children: Children;
  /** Union of `USING SCOPE` values accepted by this object. */
  readonly supportedScopes: SupportedScope;
  /** Data-category groups and values available to `WITH DATA CATEGORY`. */
  readonly dataCategoryGroups: DataCategoryGroups;
  /** Whether MRU-dependent clauses such as `FOR VIEW` are supported. */
  readonly mruEnabled: MruEnabled;
  /** Which Salesforce `SET OPTIONS` variant this object supports. */
  readonly setOptionsCapability: SetOptionsCapability;
  /** False for field-filtered schemas; server-side FIELDS() cannot be narrowed. */
  readonly fieldsComplete?: FieldsComplete;
}

/**
 * Optional runtime metadata emitted alongside generated Salesforce schemas.
 */
export interface SalesforceSchemaMetadata {
  /** Ordered Big Object index fields keyed by object API name. */
  readonly bigObjectIndexes?: Readonly<Record<string, readonly string[]>>;
  /** Data 360 string fields keyed by object API name. */
  readonly data360StringFields?: Readonly<Record<string, readonly string[]>>;
  /** Data 360 lookup fields keyed by object API name. */
  readonly data360LookupFields?: Readonly<Record<string, readonly string[]>>;
}

/** Base shape for a Kysoql Salesforce schema. */
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
  /** Field-completeness marker extracted from the object schema. */
  readonly fieldsComplete?: infer Complete extends boolean;
}
  ? Complete
  : true;

/**
 * Extracts the valid data-category group names for a Salesforce object type.
 */
export type SalesforceObjectDataCategoryGroup<ObjectType> = ObjectType extends {
  /** Data-category group map extracted from the object schema. */
  readonly dataCategoryGroups: infer Groups;
}
  ? NonNeverStringKey<Groups>
  : never;

/**
 * Extracts valid data-category values for a Salesforce object and group.
 */
export type SalesforceObjectDataCategory<
  ObjectType,
  Group extends SalesforceObjectDataCategoryGroup<ObjectType>,
> = ObjectType extends {
  /** Data-category group map used to resolve values for `Group`. */
  readonly dataCategoryGroups: infer Groups;
}
  ? Group extends keyof Groups
    ? Groups[Group] extends string
      ? Groups[Group]
      : never
    : never
  : never;

/**
 * Extracts whether a Salesforce object supports MRU-dependent query
 * features.
 */
export type SalesforceObjectMruEnabled<ObjectType> = ObjectType extends {
  /** MRU capability flag extracted from the object schema. */
  readonly mruEnabled: infer MruEnabled extends boolean;
}
  ? MruEnabled
  : boolean;

/** Extracts the USING SCOPE values supported by a Salesforce object. */
export type SalesforceObjectSupportedScope<ObjectType> = ObjectType extends {
  /** Supported `USING SCOPE` values extracted from the object schema. */
  readonly supportedScopes: infer SupportedScope extends string;
}
  ? SupportedScope
  : never;

/** Extracts the SET OPTIONS capability for a Salesforce object. */
export type SalesforceObjectSetOptionsCapability<ObjectType> =
  ObjectType extends {
    /** `SET OPTIONS` capability extracted from the object schema. */
    readonly setOptionsCapability: infer Capability extends
      SalesforceSetOptionsCapability;
  }
    ? Capability
    : "none";

/** Extracts the selected runtime value type for a Salesforce field. */
export type SalesforceFieldValue<Field> = Field extends {
  /** Runtime field value type stored in the schema definition. */
  readonly value: infer Value;
  /** Nullability flag used to include `null` in the selected value type. */
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

/** Extracts the value type accepted when filtering a Salesforce field. */
export type SalesforceFieldFilterValue<Field> = Field extends {
  /** Runtime field value type stored in the schema definition. */
  readonly value: infer Value;
  /** Salesforce type used to add SOQL literal forms such as relative dates. */
  readonly salesforceType: infer SalesforceType extends string;
  /** Nullability flag used to allow `null` as a filter value. */
  readonly nullable: infer Nullable extends boolean;
}
  ? Nullable extends true
    ? SalesforceFieldFilterScalar<Value, SalesforceType> | null
    : SalesforceFieldFilterScalar<Value, SalesforceType>
  : never;

/** Extracts whether a Salesforce field is custom. */
export type SalesforceFieldCustom<Field> = Field extends {
  /** Custom-field marker extracted from the schema definition. */
  readonly custom: infer Custom extends boolean;
}
  ? Custom
  : never;

/** Maps a Salesforce object schema to its full row value shape. */
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
