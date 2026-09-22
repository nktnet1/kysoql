import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { FieldsSelectionCheck } from "#/parser/fields-selection-parser";
import type {
  SalesforceObjectFieldsComplete,
  SalesforceRow,
  SalesforceSchema,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

import type { FilteredSchema } from "../fixtures/field-filtered.generated.js";

// Codegen's golden test renders this fixture from full Describe metadata plus
// field rules. These tests therefore exercise actual generator output.
const db = new Kysoql<FilteredSchema>();

describe("field-filtered generated schemas", () => {
  it("keeps complete/partial metadata and row inference compatible", () => {
    expectTypeOf<
      SalesforceObjectFieldsComplete<FilteredSchema["Account"]>
    >().toEqualTypeOf<false>();
    expectTypeOf<
      SalesforceObjectFieldsComplete<FilteredSchema["User"]>
    >().toEqualTypeOf<true>();
    expectTypeOf<FilteredSchema["Account"]>().toMatchTypeOf<
      SalesforceSchema[string]
    >();
    expectTypeOf<SalesforceRow<FilteredSchema["Account"]>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string;
      readonly OwnerId: string;
    }>();
  });

  it("compiles explicit selections, predicates, and orderings with retained fields", () => {
    const query = db
      .selectFrom("Account")
      .select(["Id", "Name", "Owner.Name"])
      .where("Name", "=", "Acme")
      .orderBy("Name");
    expect(query.compile().soql).toBe(
      "SELECT Id, Name, Owner.Name FROM Account WHERE Name = 'Acme' ORDER BY Name",
    );
    expectTypeOf<
      Simplify<Awaited<ReturnType<typeof query.execute>>[number]>
    >().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string;
      readonly Owner: { readonly Name: string };
    }>();
  });

  it("keeps retained parent and nested child paths usable", () => {
    const query = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "Account.Name"])
          .selectSubquery("Tasks", (tasks) => tasks.select("Id")),
      );
    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, Account.Name, (SELECT Id FROM Tasks) FROM Contacts) FROM Account",
    );
  });

  it("keeps FIELDS available on unfiltered objects", () => {
    expect(
      db.selectFrom("User").selectFields("all").limit(20).compile().soql,
    ).toBe("SELECT FIELDS(ALL) FROM User LIMIT 20");
    expect(
      db.selectFrom("User").selectFields("standard").compile().soql,
    ).toBe("SELECT FIELDS(STANDARD) FROM User");
  });

  it("preserves virtual polymorphic types and explicit known-target branches", () => {
    const query = db
      .selectFrom("Task")
      .select(["Id", "Who.Type"])
      .where("Who.Type", "=", "Lead");
    expect(query.compile().soql).toBe(
      "SELECT Id, Who.Type FROM Task WHERE Who.Type = 'Lead'",
    );
    expectTypeOf<
      FilteredSchema["Task"]["fields"]["WhoId"]["referenceTo"]
    >().toEqualTypeOf<"Contact" | "Lead">();
    expectTypeOf<
      FilteredSchema["Task"]["fields"]["WhoId"]["polymorphic"]
    >().toEqualTypeOf<true>();
    expect(
      db
        .selectFrom("Task")
        .selectTypeOf("Who", (typeOf) =>
          typeOf.when("Contact", ["Id", "LastName"]),
        )
        .compile().soql,
    ).toBe("SELECT TYPEOF Who WHEN Contact THEN Id, LastName END FROM Task");
  });

  it("blocks group selection for partial or possibly partial schemas", () => {
    type MixedSchema = {
      readonly Object: FilteredSchema["Account"] | FilteredSchema["User"];
    };
    type LegacySchema = {
      readonly User: Omit<FilteredSchema["User"], "fieldsComplete">;
    };
    type UncertainSchema = {
      readonly User: LegacySchema["User"] & {
        readonly fieldsComplete?: boolean;
      };
    };
    expectTypeOf<SalesforceRow<LegacySchema["User"]>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string;
    }>();
    expectTypeOf<LegacySchema["User"]>().toMatchTypeOf<
      SalesforceSchema[string]
    >();
    expectTypeOf<
      FieldsSelectionCheck<UncertainSchema, "User", {}, "all">
    >().toEqualTypeOf<readonly [requiresCompleteFieldSchema: never]>();
    expectTypeOf<
      FieldsSelectionCheck<MixedSchema, "Object", {}, "all">
    >().toEqualTypeOf<readonly [requiresCompleteFieldSchema: never]>();
    expectTypeOf<
      FieldsSelectionCheck<LegacySchema, "User", {}, "standard">
    >().toEqualTypeOf<readonly []>();
  });

  it("rejects filtered fields throughout the query interface at compile time", () => {
    void (() => {
      // @ts-expect-error Account's include list excludes Industry.
      db.selectFrom("Account").select("Industry");
      // @ts-expect-error Excluded fields cannot be used in WHERE.
      db.selectFrom("Account").where("Industry", "=", "Technology");
      // @ts-expect-error Excluded fields cannot be used in ORDER BY.
      db.selectFrom("Account").orderBy("Industry");
      // @ts-expect-error Excluded fields cannot be used in GROUP BY.
      db.selectFrom("Account").groupBy("Industry");
      // @ts-expect-error Aggregate arguments use the filtered field set.
      db.selectFrom("Account").select(({ fn }) => fn.count("Industry").as("n"));
      // @ts-expect-error Exclusion lists also restrict direct selections.
      db.selectFrom("Contact").select("Email");
      // @ts-expect-error Parent paths respect target field rules.
      db.selectFrom("Contact").select("Account.Industry");
      // @ts-expect-error Parent predicates respect target field rules too.
      db.selectFrom("Contact").where("Account.Industry", "=", "Technology");
      // @ts-expect-error Missing child objects have no queryable relationship.
      db.selectFrom("Account").selectSubquery("Missing__r", (c) => c.select("Id"));
      // @ts-expect-error Missing target objects do not become queryable.
      db.selectFrom("Lead");
      // @ts-expect-error Do not narrow Who to Contact when Lead is absent.
      db.selectFrom("Task").select("Who.LastName");
      db.selectFrom("Task").selectTypeOf("Who", (typeOf) =>
        // @ts-expect-error TYPEOF cannot select excluded target fields.
        typeOf.when("Contact", ["Email"]),
      );
      db.selectFrom("Task").selectTypeOf("Who", (typeOf) =>
        // @ts-expect-error An omitted target cannot be an explicit branch.
        typeOf.when("Lead", ["Id"]),
      );
      db.selectFrom("Task").selectTypeOf("Who", (typeOf) =>
        // @ts-expect-error An unknown remaining target cannot define ELSE fields.
        typeOf.when("Contact", ["Id"]).else(["Id"]),
      );
    });
  });

  it("blocks all FIELDS selectors including child queries and cleared selections", () => {
    void (() => {
      // @ts-expect-error Server expansion cannot be restricted by an include list.
      db.selectFrom("Account").selectFields("all");
      // @ts-expect-error A standard selector can still expose excluded fields.
      db.selectFrom("Account").selectFields("standard");
      // @ts-expect-error Explicit selections do not make custom expansion safe.
      db.selectFrom("Account").select("Id").selectFields("custom");
      // @ts-expect-error An exclusion rule also creates a partial schema.
      db.selectFrom("Contact").selectFields("standard");
      // @ts-expect-error clearSelect does not clear completeness metadata.
      db.selectFrom("Contact").select("Id").clearSelect().selectFields("all");
      db.selectFrom("Account").selectSubquery("Contacts", (contacts) => {
        // @ts-expect-error Child FIELDS checks the child's completeness.
        contacts.selectFields("all");
        // @ts-expect-error Standard groups are blocked in child subqueries too.
        contacts.selectFields("standard");
        // @ts-expect-error Explicit Id does not allow child custom expansion.
        contacts.select("Id").selectFields("custom");
        return contacts.select("Id");
      });
      db.selectFrom("Account").selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").selectSubquery("Tasks", (tasks) => {
          // @ts-expect-error The same check holds for nested subqueries.
          tasks.selectFields("standard");
          return tasks.select("Id");
        }),
      );
    });
  });
});
