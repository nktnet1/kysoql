import { expectTypeOf, it } from "vitest";

import type {
  ChildRelationshipName,
  FieldName,
  ParentRelationshipName,
} from "#/parser/reference-parser";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceFieldFilterValue,
  SalesforceFieldValue,
  SalesforceGeolocation,
  SalesforceObject,
  SalesforceObjectDataCategory,
  SalesforceObjectDataCategoryGroup,
  SalesforceObjectMruEnabled,
  SalesforceObjectSetOptionsCapability,
  SalesforceObjectSupportedScope,
  SalesforceParentRelationship,
  SalesforceRow,
} from "#/schema";
import type { SoqlRelativeDateLiteral } from "#/soql-relative-date-literal";
import type {
  SoqlDateLiteral,
  SoqlDateTimeLiteral,
  SoqlTimeLiteral,
} from "#/soql-temporal-literal";

type FixtureObject = SalesforceObject<{
  readonly Id: SalesforceField<string, "id", false, true, true, true>;
  readonly Amount__c: SalesforceField<number, "double", true, true, true, true>;
  readonly Date__c: SalesforceField<string, "date", true, true, true, true>;
  readonly DateTime__c: SalesforceField<
    string,
    "datetime",
    true,
    true,
    true,
    true
  >;
  readonly Time__c: SalesforceField<string, "time", true, true, true, true>;
  readonly Location__c: SalesforceField<
    SalesforceGeolocation,
    "location",
    true,
    true,
    true,
    false
  >;
}>;

it("treats Record<string, never> metadata maps as empty", () => {
  interface EmptySchema {
    readonly Empty__c: SalesforceObject<Record<string, never>>;
  }

  expectTypeOf<FieldName<EmptySchema, "Empty__c">>().toEqualTypeOf<never>();
  expectTypeOf<
    ParentRelationshipName<EmptySchema, "Empty__c">
  >().toEqualTypeOf<never>();
  expectTypeOf<
    ChildRelationshipName<EmptySchema, "Empty__c">
  >().toEqualTypeOf<never>();
  expectTypeOf<
    SalesforceObjectDataCategoryGroup<EmptySchema["Empty__c"]>
  >().toEqualTypeOf<never>();
});

it("derives nullable row values from generated field metadata", () => {
  expectTypeOf<SalesforceRow<FixtureObject>>().toEqualTypeOf<{
    readonly Id: string;
    readonly Amount__c: number | null;
    readonly Date__c: string | null;
    readonly DateTime__c: string | null;
    readonly Time__c: string | null;
    readonly Location__c: SalesforceGeolocation | null;
  }>();
});

it("derives scalar field values from nullability metadata", () => {
  expectTypeOf<
    SalesforceFieldValue<
      SalesforceField<string, "string", false, true, true, true>
    >
  >().toEqualTypeOf<string>();
  expectTypeOf<
    SalesforceFieldValue<
      SalesforceField<number, "double", true, true, true, true>
    >
  >().toEqualTypeOf<number | null>();
  expectTypeOf<SalesforceFieldValue<unknown>>().toEqualTypeOf<never>();
});

it("maps temporal filter values to wrappers while preserving nullability", () => {
  expectTypeOf<
    SalesforceFieldFilterValue<
      SalesforceField<string, "date", false, true, true, true>
    >
  >().toEqualTypeOf<SoqlDateLiteral | SoqlRelativeDateLiteral>();
  expectTypeOf<
    SalesforceFieldFilterValue<
      SalesforceField<string, "datetime", true, true, true, true>
    >
  >().toEqualTypeOf<SoqlDateTimeLiteral | SoqlRelativeDateLiteral | null>();
  expectTypeOf<
    SalesforceFieldFilterValue<
      SalesforceField<string, "time", false, true, true, true>
    >
  >().toEqualTypeOf<SoqlTimeLiteral>();
});

it("leaves non-temporal filter values unchanged", () => {
  expectTypeOf<
    SalesforceFieldFilterValue<
      SalesforceField<number, "currency", true, true, true, true>
    >
  >().toEqualTypeOf<number | null>();
  expectTypeOf<
    SalesforceFieldFilterValue<
      SalesforceField<boolean, "boolean", false, true, true, true>
    >
  >().toEqualTypeOf<boolean>();
  expectTypeOf<SalesforceFieldFilterValue<unknown>>().toEqualTypeOf<never>();
});

it("preserves parent and child relationship metadata in SalesforceObject", () => {
  type ObjectWithRelationships = SalesforceObject<
    {
      readonly Parent__c: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "Account",
        "Parent__r"
      >;
    },
    {
      readonly Parent__r: SalesforceParentRelationship<
        "Account",
        "Parent__c",
        true
      >;
    },
    {
      readonly Children__r: SalesforceChildRelationship<
        "Child__c",
        "Parent__c"
      >;
    }
  >;

  expectTypeOf<ObjectWithRelationships["parents"]["Parent__r"]>().toEqualTypeOf<
    SalesforceParentRelationship<"Account", "Parent__c", true>
  >();
  expectTypeOf<
    ObjectWithRelationships["children"]["Children__r"]
  >().toEqualTypeOf<SalesforceChildRelationship<"Child__c", "Parent__c">>();
});

it("preserves object-specific supported scope metadata", () => {
  type ScopedObject = SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    },
    Record<string, never>,
    Record<string, never>,
    "everything" | "mine"
  >;

  expectTypeOf<ScopedObject["supportedScopes"]>().toEqualTypeOf<
    "everything" | "mine"
  >();
  expectTypeOf<SalesforceObjectSupportedScope<ScopedObject>>().toEqualTypeOf<
    "everything" | "mine"
  >();
  expectTypeOf<
    SalesforceObjectSupportedScope<FixtureObject>
  >().toEqualTypeOf<never>();
});

it("preserves object-specific SET OPTIONS capability metadata", () => {
  type DloObject = SalesforceObject<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    never,
    Record<string, never>,
    boolean,
    "data360-dlo"
  >;
  type DmoObject = SalesforceObject<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    never,
    Record<string, never>,
    boolean,
    "data360-dmo"
  >;

  expectTypeOf<
    DloObject["setOptionsCapability"]
  >().toEqualTypeOf<"data360-dlo">();
  expectTypeOf<
    DmoObject["setOptionsCapability"]
  >().toEqualTypeOf<"data360-dmo">();
  expectTypeOf<
    SalesforceObjectSetOptionsCapability<DloObject>
  >().toEqualTypeOf<"data360-dlo">();
  expectTypeOf<
    SalesforceObjectSetOptionsCapability<FixtureObject>
  >().toEqualTypeOf<"none">();
});

it("preserves object-specific MRU capability metadata", () => {
  type MruObject = SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    },
    Record<string, never>,
    Record<string, never>,
    never,
    Record<string, never>,
    true
  >;
  type NonMruObject = SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    },
    Record<string, never>,
    Record<string, never>,
    never,
    Record<string, never>,
    false
  >;

  expectTypeOf<MruObject["mruEnabled"]>().toEqualTypeOf<true>();
  expectTypeOf<NonMruObject["mruEnabled"]>().toEqualTypeOf<false>();
  expectTypeOf<SalesforceObjectMruEnabled<MruObject>>().toEqualTypeOf<true>();
  expectTypeOf<
    SalesforceObjectMruEnabled<NonMruObject>
  >().toEqualTypeOf<false>();
  expectTypeOf<
    SalesforceObjectMruEnabled<FixtureObject>
  >().toEqualTypeOf<boolean>();
});

it("preserves object-specific data-category metadata", () => {
  type CategorizedObject = SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    },
    Record<string, never>,
    Record<string, never>,
    never,
    {
      readonly Geography__c: "All" | "usa__c";
      readonly Product__c: "All" | "mobile__c";
    }
  >;

  expectTypeOf<
    SalesforceObjectDataCategoryGroup<CategorizedObject>
  >().toEqualTypeOf<"Geography__c" | "Product__c">();
  expectTypeOf<
    SalesforceObjectDataCategory<CategorizedObject, "Geography__c">
  >().toEqualTypeOf<"All" | "usa__c">();
  expectTypeOf<
    SalesforceObjectDataCategoryGroup<FixtureObject>
  >().toEqualTypeOf<never>();
});

it("returns never for non-Salesforce row inputs", () => {
  expectTypeOf<SalesforceRow<unknown>>().toEqualTypeOf<never>();
});
