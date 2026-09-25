/**
 * Minimal global-describe metadata used to identify queryable Salesforce
 * objects.
 */
export interface SalesforceGlobalObjectDescription {
  /** Salesforce object API name. */
  readonly name: string;
  /** Whether Salesforce reports the object as queryable. */
  readonly queryable: boolean;
}

/**
 * Subset of the Salesforce global describe response consumed by code
 * generation.
 */
export interface SalesforceGlobalDescription {
  /** Objects returned by Salesforce global describe. */
  readonly sobjects: readonly SalesforceGlobalObjectDescription[];
}

/** Picklist value metadata consumed by schema generation. */
export interface SalesforcePicklistValue {
  /** Whether the picklist value is currently active. */
  readonly active?: boolean;
  /** Picklist API value. */
  readonly value: string;
}

/** Field metadata required to render a generated Kysoql schema. */
export interface SalesforceFieldDescription {
  /** Salesforce field API name. */
  readonly name: string;
  /** Salesforce Describe field type. */
  readonly type: string;
  /** Whether Salesforce reports the field as nillable. */
  readonly nillable: boolean;
  /** Whether Salesforce reports the field as filterable. */
  readonly filterable: boolean;
  /** Whether Salesforce reports the field as sortable. */
  readonly sortable: boolean;
  /** Whether Salesforce reports the field as groupable. */
  readonly groupable: boolean;
  /** Whether Salesforce reports the field as aggregatable. */
  readonly aggregatable: boolean;
  /** Whether this is a custom Salesforce field. */
  readonly custom: boolean;
  /** Target object API names for reference fields. */
  readonly referenceTo?: readonly string[];
  /** Parent relationship name supplied by Salesforce, if any. */
  readonly relationshipName?: string | null;
  /** Whether Salesforce marks the field as a polymorphic name-pointing reference. */
  readonly namePointing?: boolean;
  /** Whether Salesforce marks the field as a polymorphic foreign key. */
  readonly polymorphicForeignKey?: boolean;
  /** Picklist values returned by Describe for this field. */
  readonly picklistValues?: readonly SalesforcePicklistValue[];
}

/**
 * Child-relationship metadata required to render relationship subqueries.
 */
export interface SalesforceChildRelationshipDescription {
  /** API name of the child Salesforce object. */
  readonly childSObject: string;
  /** Child foreign-key field that points to the described object. */
  readonly field: string;
  /** Child relationship name used by SOQL subqueries, if Salesforce exposes one. */
  readonly relationshipName?: string | null;
}

/** Supported Salesforce USING SCOPE metadata for an object. */
export interface SalesforceSupportedScopeDescription {
  /** One `USING SCOPE` value supported by the object. */
  readonly name: string;
}

/**
 * Recursive data-category entry returned by the Salesforce metadata APIs.
 */
export interface SalesforceDataCategorySummaryResponse {
  /** Data-category API name. */
  readonly name: string;
  /** Nested child categories below this category. */
  readonly childCategories?:
    | readonly SalesforceDataCategorySummaryResponse[]
    | null;
}

/** Data-category group returned by the Salesforce metadata APIs. */
export interface SalesforceDataCategoryGroupResponse {
  /** Data-category group API name. */
  readonly name: string;
  /** Root categories in the group. */
  readonly topCategories: readonly SalesforceDataCategorySummaryResponse[];
}

/** Container returned when describing Salesforce data-category groups. */
export interface SalesforceDataCategoryGroupsResponse {
  /** Data-category groups returned for the object. */
  readonly categoryGroups: readonly SalesforceDataCategoryGroupResponse[];
}

/** Flattened data-category group stored in generated schema metadata. */
export interface SalesforceDataCategoryGroupDescription {
  /** Data-category group API name stored in the generated schema. */
  readonly name: string;
  /** Flattened category API names available in the group. */
  readonly categories: readonly string[];
}

/** Salesforce object metadata consumed by the schema renderer. */
export interface SalesforceObjectDescription {
  /** Ordered Big Object index field names, when the object is a custom Big Object. */
  readonly bigObjectIndex?: readonly string[];
  /** Codegen annotation, not a Salesforce Describe property. Omission means full. */
  readonly fieldsComplete?: boolean;
  /** Salesforce object API name. */
  readonly name: string;
  /** Validated field metadata used to render the object schema. */
  readonly fields: readonly SalesforceFieldDescription[];
  /** Whether Salesforce reports MRU support for the object. */
  readonly mruEnabled?: boolean;
  /** Child relationships available for SOQL relationship subqueries. */
  readonly childRelationships?: readonly SalesforceChildRelationshipDescription[];
  /** `USING SCOPE` values reported by Salesforce. */
  readonly supportedScopes?: readonly SalesforceSupportedScopeDescription[];
  /** Flattened data-category metadata attached to the generated object schema. */
  readonly dataCategoryGroups?: readonly SalesforceDataCategoryGroupDescription[];
}

/** Describe client contract used by schema loading and generation. */
export interface SalesforceDescribeClient {
  /** Loads Salesforce global describe metadata. */
  describeGlobal(): Promise<SalesforceGlobalDescription>;
  /** Loads Describe metadata for one Salesforce object API name. */
  describe(objectName: string): Promise<SalesforceObjectDescription>;
  /** Loads ordered custom Big Object index fields when available. */
  describeBigObjectIndex?(
    objectName: string,
  ): Promise<readonly string[] | undefined>;
  /** Loads data-category groups for an object when the backing client supports them. */
  describeDataCategoryGroups?(
    objectName: string,
  ): Promise<SalesforceDataCategoryGroupsResponse | undefined>;
}
