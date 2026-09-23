import { it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import { soql } from "#/soql";
import { soqlLikeLiteral } from "#/soql-like-literal";
import { soqlRelativeDate } from "#/soql-relative-date-literal";
import { soqlDate, soqlDateTime, soqlTime } from "#/soql-temporal-literal";

type Field<
  Value,
  SalesforceType extends string,
  Nullable extends boolean = true,
> = SalesforceField<Value, SalesforceType, Nullable, true, true, true>;

interface FilterTypeSchema {
  readonly Fixture__c: SalesforceObject<{
    readonly Base64__c: Field<string, "base64">;
    readonly Boolean__c: Field<boolean, "boolean", false>;
    readonly Combobox__c: Field<string, "combobox">;
    readonly Currency__c: Field<number, "currency">;
    readonly Date__c: Field<string, "date">;
    readonly DateTime__c: Field<string, "datetime">;
    readonly Double__c: Field<number, "double">;
    readonly Email__c: Field<string, "email">;
    readonly Encrypted__c: Field<string, "encryptedstring">;
    readonly Id: Field<string, "id", false>;
    readonly Int__c: Field<number, "int">;
    readonly MultiPicklist__c: Field<string, "multipicklist">;
    readonly Percent__c: Field<number, "percent">;
    readonly Phone__c: Field<string, "phone">;
    readonly Picklist__c: Field<string, "picklist">;
    readonly NonNullablePicklist__c: Field<string, "picklist", false>;
    readonly CurrencyIsoCode: Field<string, "picklist">;
    readonly Division: Field<string, "picklist">;
    readonly Division__c: Field<string, "picklist">;
    readonly InternalPicklist__c: SalesforceField<
      string,
      "picklist",
      true,
      false,
      true,
      true
    >;
    readonly Reference__c: Field<string, "reference">;
    readonly String__c: Field<string, "string">;
    readonly Textarea__c: Field<string, "textarea">;
    readonly Time__c: Field<string, "time">;
    readonly Url__c: Field<string, "url">;
  }>;
}

it("filters translated picklist labels with typed toLabel expressions", () => {
  const query = new Kysoql<FilterTypeSchema>().selectFrom("Fixture__c");

  query.where((eb) => eb(eb.fn.toLabel("Picklist__c"), "=", "Translated"));
  query.where((eb) => eb(eb.fn.toLabel("Picklist__c"), "!=", null));
  query.where((eb) => eb(eb.fn.toLabel("Picklist__c"), "like", "Trans%"));
  query.where((eb) => eb(eb.fn.toLabel("Division__c"), "=", "Translated"));
  query.where((eb) =>
    eb(eb.fn.toLabel("MultiPicklist__c"), "=", "Translated A;Translated B"),
  );

  query.where((eb) => {
    const translated = eb.fn.toLabel("Picklist__c");
    // @ts-expect-error WHERE toLabel expressions are not aliased SELECT expressions.
    translated.as("translated");
    return eb(translated, "=", "Translated");
  });

  query.where((eb) => {
    // @ts-expect-error toLabel WHERE predicates require picklist or multipicklist fields.
    eb.fn.toLabel("String__c");
    return eb("Picklist__c", "=", "value");
  });

  query.where((eb) => {
    // @ts-expect-error toLabel WHERE predicates require filterable generated fields.
    eb.fn.toLabel("InternalPicklist__c");
    return eb("Picklist__c", "=", "value");
  });

  query.where((eb) => {
    // @ts-expect-error Salesforce forbids filtering toLabel(CurrencyIsoCode) in WHERE.
    eb.fn.toLabel("CurrencyIsoCode");
    return eb("Picklist__c", "=", "value");
  });

  query.where((eb) => {
    // @ts-expect-error Salesforce forbids filtering toLabel(Division) in WHERE.
    eb.fn.toLabel("Division");
    return eb("Picklist__c", "=", "value");
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("NonNullablePicklist__c");
    // @ts-expect-error Non-nullable translated fields reject null equality operands.
    return eb(translated, "=", null);
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("Picklist__c");
    // @ts-expect-error toLabel comparisons use translated string labels.
    return eb(translated, "=", 1);
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("Picklist__c");
    // @ts-expect-error Salesforce doesn't expose ordered comparisons on translated picklist labels.
    return eb(translated, ">", "Translated");
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("Picklist__c");
    // @ts-expect-error toLabel WHERE predicates intentionally expose only documented equality/LIKE comparisons.
    return eb(translated, "in", ["Translated"]);
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("MultiPicklist__c");
    // @ts-expect-error Multipicklist toLabel filters don't expose LIKE.
    return eb(translated, "like", "Translated%");
  });

  query.where((eb) => {
    const translated = eb.fn.toLabel("MultiPicklist__c");
    // @ts-expect-error toLabel expressions don't expose raw multipicklist INCLUDES semantics.
    return eb(translated, "includes", ["Translated A"]);
  });
});

it("accepts equality values for every supported Salesforce scalar field type", () => {
  const query = new Kysoql<FilterTypeSchema>().selectFrom("Fixture__c");

  query.where("Base64__c", "=", "SGVsbG8=");
  query.where("Boolean__c", "=", true);
  query.where("Combobox__c", "=", "Option");
  query.where("Currency__c", "=", 12.5);
  query.where("Date__c", "=", soqlDate("2026-09-17"));
  query.where("Date__c", "=", soqlRelativeDate("TODAY"));
  query.where("DateTime__c", "=", soqlDateTime("2026-09-17T12:00:00Z"));
  query.where("DateTime__c", "=", soqlRelativeDate("YESTERDAY"));
  query.where("Double__c", "=", 12.5);
  query.where("Email__c", "=", "user@example.com");
  query.where("Encrypted__c", "=", "secret");
  query.where("Id", "=", "001000000000001");
  query.where("Int__c", "=", 12);
  query.where("MultiPicklist__c", "=", "A;B");
  query.where("Percent__c", "=", 12.5);
  query.where("Phone__c", "=", "+61 2 0000 0000");
  query.where("Picklist__c", "=", "Option");
  query.where("Reference__c", "=", "001000000000001");
  query.where("String__c", "=", "value");
  query.where("Textarea__c", "=", "value");
  query.where("Time__c", "=", soqlTime("12:00:00Z"));
  query.where("Url__c", "=", "https://example.com");

  query.where("Base64__c", "!=", null);
  query.where("Currency__c", "=", null);

  // @ts-expect-error Non-nullable scalar fields reject null.
  query.where("Boolean__c", "=", null);
  // @ts-expect-error Non-nullable Id fields reject null.
  query.where("Id", "=", null);
});

it("accepts ordered comparisons for exactly the enabled Salesforce types", () => {
  const query = new Kysoql<FilterTypeSchema>().selectFrom("Fixture__c");

  query.where("Currency__c", ">", 1);
  query.where("Date__c", ">=", soqlDate("2026-01-01"));
  query.where("Date__c", "<", soqlRelativeDate("TOMORROW"));
  query.where("DateTime__c", "<", soqlDateTime("2027-01-01T00:00:00Z"));
  query.where("DateTime__c", ">=", soqlRelativeDate("TODAY"));
  query.where("Double__c", "<=", 1.5);
  query.where("Email__c", ">", "a@example.com");
  query.where("Id", ">=", "001000000000001");
  query.where("Int__c", "<", 10);
  query.where("Percent__c", "<=", 99.9);
  query.where("Phone__c", ">", "+1");
  query.where("Reference__c", ">=", "001000000000001");
  query.where("String__c", "<", "z");
  query.where("Textarea__c", "<=", "z");
  query.where("Time__c", ">", soqlTime("09:00:00Z"));
  query.where("Url__c", "<", "https://z.example");

  // @ts-expect-error Ordered comparisons reject nullable null operands.
  query.where("Currency__c", ">", null);
  // @ts-expect-error Base64 isn't in the ordered Salesforce type set.
  query.where("Base64__c", ">", "SGVsbG8=");
  // @ts-expect-error Boolean isn't in the ordered Salesforce type set.
  query.where("Boolean__c", ">", true);
  // @ts-expect-error Combobox isn't in the ordered Salesforce type set.
  query.where("Combobox__c", ">", "Option");
  // @ts-expect-error Encrypted strings aren't order-comparable.
  query.where("Encrypted__c", ">", "secret");
  // @ts-expect-error Multipicklists aren't order-comparable.
  query.where("MultiPicklist__c", ">", "A;B");
  // @ts-expect-error Picklists aren't in the ordered Salesforce type set.
  query.where("Picklist__c", ">", "Option");
  // @ts-expect-error Relative date literals are not valid time operands.
  query.where("Time__c", ">", soqlRelativeDate("TODAY"));
});

it("accepts explicit raw predicates and operands", () => {
  const query = new Kysoql<FilterTypeSchema>().selectFrom("Fixture__c");

  query.where(soql.raw("String__c = 'trusted'"));
  query.where("String__c", "=", soql.raw("'trusted'"));
  query.orderBy(soql.raw("String__c"));
  query.select(soql.raw<{ readonly rawValue: string }>("String__c rawValue"));
});

it("accepts LIKE for exactly the enabled Salesforce string-like types", () => {
  const query = new Kysoql<FilterTypeSchema>().selectFrom("Fixture__c");

  query.where("Combobox__c", "like", "Opt%");
  query.where("Email__c", "like", "%@example.com");
  query.where("Phone__c", "like", "+61%");
  query.where("Picklist__c", "like", "Opt%");
  query.where("String__c", "like", "value%");
  query.where("String__c", "like", soqlLikeLiteral("value%_literal"));
  // @ts-expect-error LIKE literal helpers are not equality operands.
  query.where("String__c", "=", soqlLikeLiteral("value%_literal"));
  query.where("Textarea__c", "like", "%value%");
  query.where("Url__c", "like", "https://example.com/%");

  // @ts-expect-error LIKE rejects nullable null operands.
  query.where("String__c", "like", null);
  // @ts-expect-error Base64 isn't in the LIKE Salesforce type set.
  query.where("Base64__c", "like", "SGVsbG8=%");
  // @ts-expect-error Boolean isn't in the LIKE Salesforce type set.
  query.where("Boolean__c", "like", "true%");
  // @ts-expect-error Currency isn't in the LIKE Salesforce type set.
  query.where("Currency__c", "like", "12%");
  // @ts-expect-error Date isn't in the LIKE Salesforce type set.
  query.where("Date__c", "like", "2026%");
  // @ts-expect-error DateTime isn't in the LIKE Salesforce type set.
  query.where("DateTime__c", "like", "2026%");
  // @ts-expect-error Double isn't in the LIKE Salesforce type set.
  query.where("Double__c", "like", "12%");
  // @ts-expect-error Encrypted strings don't support LIKE.
  query.where("Encrypted__c", "like", "secret%");
  // @ts-expect-error Id isn't in the LIKE Salesforce type set.
  query.where("Id", "like", "001%");
  // @ts-expect-error Int isn't in the LIKE Salesforce type set.
  query.where("Int__c", "like", "12%");
  // @ts-expect-error Multipicklists aren't in the LIKE Salesforce type set.
  query.where("MultiPicklist__c", "like", "A%");
  // @ts-expect-error Percent isn't in the LIKE Salesforce type set.
  query.where("Percent__c", "like", "12%");
  // @ts-expect-error Reference isn't in the LIKE Salesforce type set.
  query.where("Reference__c", "like", "001%");
  // @ts-expect-error Time isn't in the LIKE Salesforce type set.
  query.where("Time__c", "like", "09:%");
});
