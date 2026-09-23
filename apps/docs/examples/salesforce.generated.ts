/**
 * Synthetic schema for documentation typechecks, NOT a real Describe output.
 * Custom fields, category values, and capabilities are deliberate test fixtures.
 * Generate your own schema before using the documentation against Salesforce.
 */
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceGeolocation,
  SalesforceObject,
  SalesforceParentRelationship,
} from "@kysoql/core";

type Field<
  Value,
  Type extends string,
  Nullable extends boolean = false,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
  ActiveValue extends string = never,
  Custom extends boolean = false,
  Polymorphic extends boolean = false,
> = SalesforceField<Value, {
  readonly salesforceType: Type;
  readonly nullable: Nullable;
  readonly filterable: true;
  readonly sortable: true;
  readonly groupable: true;
  readonly aggregatable: true;
  readonly referenceTo: ReferenceTo;
  readonly relationshipName: RelationshipName;
  readonly activePicklistValue: ActiveValue;
  readonly custom: Custom;
  readonly polymorphic: Polymorphic;
}>;

type Empty = Record<string, never>;
type Article = SalesforceObject<{
  Id: Field<string, "id">;
  Title: Field<string, "string">;
  PublishStatus: Field<string, "picklist", false, never, never, "Online" | "Draft" | "Archived">;
}, Empty, Empty, never, {
  Geography__c: "usa__c" | "france__c";
  Product__c: "mobile_phones__c";
}>;

export interface SalesforceSchema {
  Account: SalesforceObject<{
    Id: Field<string, "id">;
    Name: Field<string, "string">;
    BillingCity: Field<string, "string", true>;
    AnnualRevenue: Field<number, "currency", true>;
    Phone: Field<string, "phone", true>;
    NumberOfEmployees: Field<number, "int", true>;
    IsDeleted: Field<boolean, "boolean">;
    Type: Field<string, "picklist", true, never, never, "Customer - Direct" | "Customer - Channel">;
    Interests__c: Field<string, "multipicklist", true, never, never, "Email" | "Events", true>;
    Office__c: SalesforceField<SalesforceGeolocation, {
      salesforceType: "location";
      nullable: true;
      filterable: true;
      sortable: true;
      groupable: false;
      aggregatable: false;
      custom: true;
    }>;
  }, Empty, {
    Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    Opportunities: SalesforceChildRelationship<"Opportunity", "AccountId">;
  }, "mine" | "everything", Empty, true>;
  Contact: SalesforceObject<{
    Id: Field<string, "id">;
    LastName: Field<string, "string">;
    AccountId: Field<string, "reference", true, "Account", "Account">;
    CreatedById: Field<string, "reference", false, "User", "CreatedBy">;
  }, {
    Account: SalesforceParentRelationship<"Account", "AccountId", true>;
    CreatedBy: SalesforceParentRelationship<"User", "CreatedById", false>;
  }, {
    Cases: SalesforceChildRelationship<"Case", "ContactId">;
  }>;
  Case: SalesforceObject<{
    Id: Field<string, "id">;
    Subject: Field<string, "string", true>;
    ContactId: Field<string, "reference", true, "Contact", "Contact">;
  }, {
    Contact: SalesforceParentRelationship<"Contact", "ContactId", true>;
  }>;
  Opportunity: SalesforceObject<{
    Id: Field<string, "id">;
    Name: Field<string, "string">;
    Amount: Field<number, "currency", true>;
    ExpectedRevenue: Field<number, "currency", true>;
    AccountId: Field<string, "reference", true, "Account", "Account">;
    CloseDate: Field<string, "date">;
    CreatedDate: Field<string, "datetime">;
    IsClosed: Field<boolean, "boolean">;
    StageName: Field<string, "picklist", false, never, never, "Prospecting" | "Closed Won" | "Closed Lost">;
    Type: Field<string, "picklist", true, never, never, "New Customer" | "Existing Customer">;
  }, { Account: SalesforceParentRelationship<"Account", "AccountId", true> }>;
  User: SalesforceObject<{
    Id: Field<string, "id">;
    Alias: Field<string, "string">;
  }>;
  Event: SalesforceObject<{
    Id: Field<string, "id">;
    Subject: Field<string, "string", true>;
    WhatId: Field<string, "reference", true, "Account" | "Opportunity", "What", never, false, true>;
  }, { What: SalesforceParentRelationship<"Account" | "Opportunity", "WhatId", true> }>;
  KnowledgeArticleVersion: Article;
  FAQ__kav: Article;
  UserProfileFeed: SalesforceObject<{
    Id: Field<string, "id">;
    CreatedDate: Field<string, "datetime">;
  }>;
  ContactPoint__dll: SalesforceObject<{
    Id: Field<string, "id">;
    EmailOptIn__c: Field<string, "string", false, never, never, never, true>;
  }, Empty, Empty, never, Empty, false, "data360-dlo">;
  UnifiedIndividual__dlm: SalesforceObject<{
    Id: Field<string, "id">;
  }, Empty, Empty, never, Empty, false, "data360-dmo">;
}
