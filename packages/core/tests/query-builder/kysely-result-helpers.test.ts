import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import type { NotNull, Simplify } from "#/util/type-utils";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
  }>;
}

type ExecutedRow<Query> = Query extends {
  execute(): Promise<readonly (infer Output)[]>;
}
  ? Output
  : never;

describe("Kysely-style result type helpers", () => {
  it("casts, narrows, and asserts result types without changing SOQL", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);
    const narrowed = query.$narrowType<{ Name: NotNull }>();
    const explicit = query.$narrowType<{ Name: string }>();
    const cast = query.$castTo<{ accountId: string }>();
    const asserted = query.$assertType<{
      readonly Id: string;
      readonly Name: string | null;
    }>();

    expect(narrowed.compile()).toEqual(query.compile());
    expect(explicit.compile()).toEqual(query.compile());
    expect(cast.compile()).toEqual(query.compile());
    expect(asserted.compile()).toEqual(query.compile());

    expectTypeOf<Simplify<ExecutedRow<typeof narrowed>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string;
    }>();
    expectTypeOf<Simplify<ExecutedRow<typeof explicit>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string;
    }>();
    expectTypeOf<ExecutedRow<typeof cast>>().toEqualTypeOf<{
      accountId: string;
    }>();
  });

  it("keeps the helpers available on aggregate and relationship builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.max("Name").as("name"))
      .$narrowType<{ name: NotNull }>();

    expectTypeOf<Simplify<ExecutedRow<typeof aggregate>>>().toEqualTypeOf<{
      readonly name: string;
    }>();

    const relationshipSchema = new Kysoql<{
      readonly Parent__c: SalesforceObject<
        { readonly Id: SalesforceField<string, "id", false, true, true, true> },
        Record<string, never>,
        {
          readonly Children__r: {
            readonly object: "Child__c";
            readonly field: "Parent__c";
          };
        }
      >;
      readonly Child__c: SalesforceObject<{
        readonly Id: SalesforceField<string, "id", false, true, true, true>;
        readonly Name: SalesforceField<string, "string", true, true, true, true>;
        readonly Parent__c: SalesforceField<
          string,
          "reference",
          false,
          true,
          true,
          true,
          "Parent__c",
          "Parent__r"
        >;
      }>;
    }>();

    const relationshipQuery = relationshipSchema
      .selectFrom("Parent__c")
      .select("Id")
      .selectSubquery("Children__r", (children) =>
        children
          .select(["Id", "Name"])
          .$narrowType<{ Name: NotNull }>()
          .$assertType<{ readonly Id: string; readonly Name: string }>(),
      );

    expect(relationshipQuery.compile().soql).toBe(
      "SELECT Id, (SELECT Id, Name FROM Children__r) FROM Parent__c",
    );
  });
});
