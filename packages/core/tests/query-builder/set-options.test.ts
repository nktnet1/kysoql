import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

type Field<Value = string, Type extends string = "string"> = SalesforceField<
  Value,
  Type,
  false,
  true,
  true,
  true,
  never,
  never,
  never,
  true
>;

type EmptyRelationships = Record<string, never>;
type EmptyCategories = Record<string, never>;

type Data360Object<
  Fields extends Record<string, Field<unknown, string>>,
  Capability extends "data360-dlo" | "data360-dmo",
> = SalesforceObject<
  Fields,
  EmptyRelationships,
  EmptyRelationships,
  never,
  EmptyCategories,
  false,
  Capability
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
  readonly ContactPoint__dll: Data360Object<
    {
      readonly Id: Field<string, "id">;
      readonly EmailOptIn__c: Field;
      readonly Segment__c: Field;
    },
    "data360-dlo"
  >;
  readonly UnifiedIndividual__dlm: Data360Object<
    {
      readonly Id: Field<string, "id">;
      readonly EmailOptIn__c: Field;
    },
    "data360-dmo"
  >;
}

describe("SET OPTIONS", () => {
  it("compiles typed DLO dataspace and empty-string options at the end", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select(["Id", "EmailOptIn__c"])
      .where("EmailOptIn__c", "=", "")
      .limit(10)
      .setOptions({ dataspace: "default", honorEmptyStrings: true });

    expect(query.compile().soql).toBe(
      "SELECT Id, EmailOptIn__c FROM ContactPoint__dll WHERE EmailOptIn__c = '' LIMIT 10 SET OPTIONS (dataspace='default', honorEmptyStrings=true)",
    );
  });

  it("escapes dataspace values through the normal SOQL literal compiler", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select("Id")
      .setOptions({ dataspace: "team's data" });

    expect(query.compile().soql).toBe(
      "SELECT Id FROM ContactPoint__dll SET OPTIONS (dataspace='team\\'s data')",
    );
  });

  it("supports honorEmptyStrings on simple DMO queries", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("UnifiedIndividual__dlm")
      .select(["Id", "EmailOptIn__c"])
      .where("EmailOptIn__c", "=", "")
      .setOptions({ honorEmptyStrings: true });

    expect(query.compile().soql).toBe(
      "SELECT Id, EmailOptIn__c FROM UnifiedIndividual__dlm WHERE EmailOptIn__c = '' SET OPTIONS (honorEmptyStrings=true)",
    );
  });

  it("supports DLO SET OPTIONS on aggregate and count queries", () => {
    const aggregate = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select((eb) => eb.fn.count("Id").as("records"))
      .setOptions({ dataspace: "default" });
    const count = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select((eb) => eb.fn.count())
      .setOptions({ dataspace: "default", honorEmptyStrings: false });

    expect(aggregate.compile().soql).toBe(
      "SELECT COUNT(Id) records FROM ContactPoint__dll SET OPTIONS (dataspace='default')",
    );
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM ContactPoint__dll SET OPTIONS (dataspace='default', honorEmptyStrings=false)",
    );
  });

  it("replaces SET OPTIONS immutably", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select("Id");
    const first = base.setOptions({ dataspace: "first" });
    const second = first.setOptions({
      dataspace: "second",
      honorEmptyStrings: true,
    });

    expect(base.toOperationNode().setOptions).toBeUndefined();
    expect(first.toOperationNode().setOptions).toMatchObject({
      kind: "SetOptionsNode",
      dataspace: { kind: "ValueNode", value: "first" },
    });
    expect(second.toOperationNode().setOptions).toEqual({
      kind: "SetOptionsNode",
      dataspace: { kind: "ValueNode", value: "second" },
      honorEmptyStrings: true,
    });
    expect(Object.isFrozen(second.toOperationNode().setOptions)).toBe(true);
  });

  it("keeps object capabilities type-safe", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FixtureSchema>();

      db.selectFrom("ContactPoint__dll")
        .select("Id")
        .setOptions({ dataspace: "default" });
      db.selectFrom("UnifiedIndividual__dlm")
        .select("Id")
        .setOptions({ honorEmptyStrings: true });
      db.selectFrom("ContactPoint__dll")
        .select((eb) => eb.fn.count())
        .setOptions({ dataspace: "default" });

      const dlo = db.selectFrom("ContactPoint__dll").select("Id");
      // @ts-expect-error DLO queries require a dataspace when SET OPTIONS is used.
      dlo.setOptions({ honorEmptyStrings: true });

      const dmo = db.selectFrom("UnifiedIndividual__dlm").select("Id");
      // @ts-expect-error dataspace is not valid on DMO SET OPTIONS.
      dmo.setOptions({ dataspace: "default", honorEmptyStrings: true });

      const account = db.selectFrom("Account").select("Id");
      // @ts-expect-error Platform objects do not support literal Data 360 SET OPTIONS.
      account.setOptions({ honorEmptyStrings: true });

      const dmoAggregate = db
        .selectFrom("UnifiedIndividual__dlm")
        .select((eb) => eb.fn.count());
      // @ts-expect-error DMO aggregate queries are outside the documented simple-query surface.
      dmoAggregate.setOptions({ honorEmptyStrings: true });
    };

    expect(typeAssertions).toBeTypeOf("function");
  });

  it("guards capability and option shape at the compiler boundary", () => {
    const db = new Kysoql<FixtureSchema>();

    const missingDataspace = db
      .selectFrom("ContactPoint__dll")
      .select("Id")
      .setOptions({ honorEmptyStrings: true } as never);
    expect(() => missingDataspace.compile()).toThrow(
      "SOQL Data 360 DLO queries using SET OPTIONS require dataspace.",
    );

    const dmoDataspace = db
      .selectFrom("UnifiedIndividual__dlm")
      .select("Id")
      .setOptions({ dataspace: "default" } as never);
    expect(() => dmoDataspace.compile()).toThrow(
      "SOQL SET OPTIONS dataspace is valid only for Data 360 DLO queries.",
    );

    const platform = db
      .selectFrom("Account")
      .select("Id")
      .setOptions({ honorEmptyStrings: true } as never);
    expect(() => platform.compile()).toThrow(
      "SOQL literal SET OPTIONS is valid only for Data 360 DLO or DMO queries.",
    );

    const dmoAggregate = db
      .selectFrom("UnifiedIndividual__dlm")
      .setOptions({ honorEmptyStrings: true })
      .select((eb) => eb.fn.count());
    expect(() => dmoAggregate.compile()).toThrow(
      "SOQL SET OPTIONS honorEmptyStrings on Data 360 DMOs supports only simple non-aggregate queries.",
    );

    const aliasedDmoAggregate = db
      .selectFrom("UnifiedIndividual__dlm")
      .setOptions({ honorEmptyStrings: true })
      .select((eb) => eb.fn.count("Id").as("records"));
    expect(() => aliasedDmoAggregate.compile()).toThrow(
      "SOQL SET OPTIONS honorEmptyStrings on Data 360 DMOs supports only simple non-aggregate queries.",
    );
  });

  it("rejects malformed runtime option bags", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("ContactPoint__dll")
      .select("Id");

    expect(() => query.setOptions({} as never)).toThrow(
      "SOQL SET OPTIONS requires at least one option.",
    );
    expect(() => query.setOptions({ dataspace: "" } as never)).toThrow(
      "SOQL SET OPTIONS dataspace must be a non-empty string.",
    );
    expect(() =>
      query.setOptions({ dataspace: "default", unknown: true } as never),
    ).toThrow(
      "SOQL SET OPTIONS supports only dataspace and honorEmptyStrings for Data 360 queries.",
    );
    expect(() =>
      query.setOptions({
        dataspace: "default",
        honorEmptyStrings: "yes",
      } as never),
    ).toThrow("SOQL SET OPTIONS honorEmptyStrings must be a boolean.");
  });
});
