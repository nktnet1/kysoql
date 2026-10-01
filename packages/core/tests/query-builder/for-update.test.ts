import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

type Field<T = string> = SalesforceField<T, "string", false, true, true, true>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: Field;
  }>;
}

describe("Apex FOR UPDATE", () => {
  it("compiles FOR UPDATE through the explicit Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "=", "Acme")
      .limit(1)
      .apex()
      .forUpdate();

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name = 'Acme' LIMIT 1 FOR UPDATE",
    );
  });

  it("keeps the Apex context compile-only", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .forUpdate();

    expect("execute" in query).toBe(false);
    expect("executeAll" in query).toBe(false);
  });

  it("stores a frozen immutable FOR UPDATE node", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();
    const locked = base.forUpdate();

    expect(base.toOperationNode().forUpdate).toBeUndefined();
    expect(locked.toOperationNode().forUpdate).toEqual({
      kind: "ForUpdateNode",
    });
    expect(Object.isFrozen(locked.toOperationNode().forUpdate)).toBe(true);
    expect(Object.isFrozen(locked.toOperationNode())).toBe(true);
  });

  it("keeps repeated FOR UPDATE calls idempotent", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .forUpdate()
      .forUpdate();

    expect(query.compile().soql).toBe("SELECT Id FROM Account FOR UPDATE");
  });

  it("rejects ORDER BY with FOR UPDATE at the compiler boundary", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .orderBy("Name")
      .apex()
      .forUpdate();

    expect(() => query.compile()).toThrow(
      "SOQL FOR UPDATE cannot be combined with ORDER BY.",
    );
  });

  it("keeps FOR UPDATE out of the normal executable query surface", () => {
    const typeAssertions = () => {
      const query = new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id");

      // @ts-expect-error FOR UPDATE requires the explicit Apex context.
      query.forUpdate();

      const apexQuery = query.apex().forUpdate();

      // @ts-expect-error Apex-context queries are compile-only in core.
      apexQuery.execute();
      // @ts-expect-error QueryAll is an API transport operation, not Apex compilation.
      apexQuery.executeAll();
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
