import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

type Field<T = string> = SalesforceField<T, "string", false, true, true, true>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: Field;
    readonly AnnualRevenue: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true,
      never,
      never,
      never,
      true
    >;
  }>;
}

describe("Apex ALL ROWS", () => {
  it("compiles ALL ROWS through the explicit Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "=", "Acme")
      .orderBy("Name", "asc")
      .limit(10)
      .offset(2)
      .apex()
      .allRows();

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name = 'Acme' ORDER BY Name ASC LIMIT 10 OFFSET 2 ALL ROWS",
    );
  });

  it("supports aggregate-result and bare COUNT() Apex queries", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
      .apex()
      .allRows();
    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .apex()
      .allRows();

    expect(aggregate.compile().soql).toBe(
      "SELECT SUM(AnnualRevenue) totalRevenue FROM Account ALL ROWS",
    );
    expect(count.compile().soql).toBe("SELECT COUNT() FROM Account ALL ROWS");
  });

  it("stores a frozen immutable ALL ROWS node and keeps repeated calls idempotent", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();
    const allRows = base.allRows();
    const repeated = allRows.allRows();

    expect(base.toOperationNode().allRows).toBeUndefined();
    expect(allRows.toOperationNode().allRows).toEqual({
      kind: "AllRowsNode",
    });
    expect(Object.isFrozen(allRows.toOperationNode().allRows)).toBe(true);
    expect(Object.isFrozen(allRows.toOperationNode())).toBe(true);
    expect(repeated.compile().soql).toBe("SELECT Id FROM Account ALL ROWS");
  });

  it("rejects ALL ROWS with FOR UPDATE at the compiler boundary", () => {
    const db = new Kysoql<FixtureSchema>();
    const allRowsThenLock = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .allRows()
      .forUpdate();
    const lockThenAllRows = db
      .selectFrom("Account")
      .select("Id")
      .apex()
      .forUpdate()
      .allRows();

    expect(() => allRowsThenLock.compile()).toThrow(
      "SOQL ALL ROWS cannot be combined with FOR UPDATE.",
    );
    expect(() => lockThenAllRows.compile()).toThrow(
      "SOQL ALL ROWS cannot be combined with FOR UPDATE.",
    );
  });

  it("keeps ALL ROWS out of the normal executable query surface", () => {
    const typeAssertions = () => {
      const query = new Kysoql<FixtureSchema>()
        .selectFrom("Account")
        .select("Id");

      // @ts-expect-error ALL ROWS requires the explicit Apex context.
      query.allRows();

      const apexQuery = query.apex().allRows();

      // @ts-expect-error Apex-context queries are compile-only in core.
      apexQuery.execute();
      // @ts-expect-error QueryAll is an API transport operation, not Apex compilation.
      apexQuery.executeAll();
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
