export interface SalesforceGlobalObjectDescription {
  readonly name: string;
  readonly queryable: boolean;
}

export interface SalesforceGlobalDescription {
  readonly sobjects: readonly SalesforceGlobalObjectDescription[];
}

export interface SalesforcePicklistValue {
  readonly active?: boolean;
  readonly value: string;
}

export interface SalesforceFieldDescription {
  readonly name: string;
  readonly type: string;
  readonly nillable: boolean;
  readonly filterable: boolean;
  readonly sortable: boolean;
  readonly groupable: boolean;
  readonly aggregatable: boolean;
  readonly custom: boolean;
  readonly referenceTo?: readonly string[];
  readonly relationshipName?: string | null;
  readonly namePointing?: boolean;
  readonly polymorphicForeignKey?: boolean;
  readonly picklistValues?: readonly SalesforcePicklistValue[];
}

export interface SalesforceChildRelationshipDescription {
  readonly childSObject: string;
  readonly field: string;
  readonly relationshipName?: string | null;
}

export interface SalesforceSupportedScopeDescription {
  readonly name: string;
}

export interface SalesforceDataCategorySummaryResponse {
  readonly name: string;
  readonly childCategories?:
    | readonly SalesforceDataCategorySummaryResponse[]
    | null;
}

export interface SalesforceDataCategoryGroupResponse {
  readonly name: string;
  readonly topCategories: readonly SalesforceDataCategorySummaryResponse[];
}

export interface SalesforceDataCategoryGroupsResponse {
  readonly categoryGroups: readonly SalesforceDataCategoryGroupResponse[];
}

export interface SalesforceDataCategoryGroupDescription {
  readonly name: string;
  readonly categories: readonly string[];
}

export interface SalesforceObjectDescription {
  /** Codegen annotation, not a Salesforce Describe property. Omission means full. */
  readonly fieldsComplete?: boolean;
  readonly name: string;
  readonly fields: readonly SalesforceFieldDescription[];
  readonly mruEnabled?: boolean;
  readonly childRelationships?: readonly SalesforceChildRelationshipDescription[];
  readonly supportedScopes?: readonly SalesforceSupportedScopeDescription[];
  readonly dataCategoryGroups?: readonly SalesforceDataCategoryGroupDescription[];
}

export interface SalesforceDescribeClient {
  describeGlobal(): Promise<SalesforceGlobalDescription>;
  describe(objectName: string): Promise<SalesforceObjectDescription>;
  describeDataCategoryGroups?(
    objectName: string,
  ): Promise<SalesforceDataCategoryGroupsResponse | undefined>;
}
