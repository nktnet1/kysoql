import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import type { SalesforceField, SalesforceObject } from "#src/schema";

type Field<Value = string, Type extends string = "string"> = SalesforceField<
  Value,
  Type,
  false,
  true,
  true,
  true
>;

type DataCategoryFixture = {
  readonly Geography__c: "All" | "usa__c";
};

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: Field;
  }>;
  readonly KnowledgeArticleVersion: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly PublishStatus: Field<string, "picklist">;
    },
    Record<string, never>,
    Record<string, never>,
    never,
    DataCategoryFixture
  >;
}

describe("Apex access modes", () => {
  it("compiles explicit USER_MODE before trailing clauses", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "=", "Acme")
      .limit(1)
      .apex()
      .withUserMode()
      .forUpdate();

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name = 'Acme' WITH USER_MODE LIMIT 1 FOR UPDATE",
    );
  });

  it("compiles explicit SYSTEM_MODE", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .withSystemMode();

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WITH SYSTEM_MODE",
    );
  });

  it("does not infer an Apex access mode when none is requested", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();

    expect(query.compile().soql).toBe("SELECT Id FROM Account");
    expect(query.toOperationNode().apexAccessMode).toBeUndefined();
  });

  it("replaces access modes immutably", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();
    const userMode = base.withUserMode();
    const systemMode = userMode.withSystemMode();

    expect(base.toOperationNode().apexAccessMode).toBeUndefined();
    expect(userMode.toOperationNode().apexAccessMode).toEqual({
      kind: "ApexAccessModeNode",
      mode: "user",
    });
    expect(systemMode.toOperationNode().apexAccessMode).toEqual({
      kind: "ApexAccessModeNode",
      mode: "system",
    });
    expect(Object.isFrozen(userMode.toOperationNode().apexAccessMode)).toBe(
      true,
    );
    expect(Object.isFrozen(systemMode.toOperationNode())).toBe(true);
  });

  it("rejects another WITH filtering form alongside an Apex access mode", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .where("PublishStatus", "=", "Online")
      .withDataCategory("Geography__c", "at", "usa__c")
      .apex()
      .withUserMode();

    expect(() => query.compile()).toThrow(
      "SOQL Apex access modes cannot be combined with another WITH filtering clause.",
    );
  });

  it("keeps access-mode syntax behind the explicit Apex context", () => {
    const typeAssertions = () => {
      const query = new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id");

      // @ts-expect-error Apex access modes require the explicit Apex context.
      query.withUserMode();
      // @ts-expect-error Apex access modes require the explicit Apex context.
      query.withSystemMode();

      const apexQuery = query.apex();
      apexQuery.withUserMode();
      apexQuery.withSystemMode();

      // @ts-expect-error SECURITY_ENFORCED is intentionally not exposed by the current Apex surface.
      apexQuery.withSecurityEnforced();
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
