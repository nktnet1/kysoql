import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import { soqlDate } from "#/soql-temporal-literal";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
    readonly CloseDate: SalesforceField<
      string,
      "date",
      true,
      true,
      true,
      true
    >;
  }>;
}

describe("IN and NOT IN compilation", () => {
  it("compiles scalar value lists with normal SOQL literal escaping", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "in", ["Acme", "Bob's BBQ"])
      .where("Id", "not in", ["001000000000001", "001000000000002"])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name IN ('Acme', 'Bob\\'s BBQ') AND Id NOT IN ('001000000000001', '001000000000002')",
    );
  });

  it("compiles temporal list members as unquoted SOQL literals", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("CloseDate", "in", [
        soqlDate("2026-01-01"),
        soqlDate("2026-12-31"),
      ])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE CloseDate IN (2026-01-01, 2026-12-31)",
    );
  });
});
