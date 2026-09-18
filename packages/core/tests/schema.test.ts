import { expectTypeOf, it } from "vitest";

import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceFieldFilterValue,
  SalesforceFieldValue,
  SalesforceObject,
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
}>;

it("derives nullable row values from generated field metadata", () => {
  expectTypeOf<SalesforceRow<FixtureObject>>().toEqualTypeOf<{
    readonly Id: string;
    readonly Amount__c: number | null;
    readonly Date__c: string | null;
    readonly DateTime__c: string | null;
    readonly Time__c: string | null;
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

it("returns never for non-Salesforce row inputs", () => {
  expectTypeOf<SalesforceRow<unknown>>().toEqualTypeOf<never>();
});
