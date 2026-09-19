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

export interface SalesforceObjectDescription {
  readonly name: string;
  readonly fields: readonly SalesforceFieldDescription[];
  readonly childRelationships?: readonly SalesforceChildRelationshipDescription[];
  readonly supportedScopes?: readonly SalesforceSupportedScopeDescription[];
}

export interface SalesforceDescribeClient {
  describeGlobal(): Promise<SalesforceGlobalDescription>;
  describe(objectName: string): Promise<SalesforceObjectDescription>;
}
