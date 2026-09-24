import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";
import { soqlMultiSelectAnd } from "#/soql-multi-select-literal";

type MultiPicklistField = SalesforceField<
  string,
  "multipicklist",
  true,
  true,
  true,
  true,
  never,
  never,
  "Alpha" | "Beta" | "O'Reilly"
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Tags__c: MultiPicklistField;
  }>;
}

describe("INCLUDES and EXCLUDES compilation", () => {
  it("compiles multipicklist value lists", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Tags__c", "includes", ["Alpha", "Beta"])
      .where("Tags__c", "excludes", ["O'Reilly"])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE Tags__c INCLUDES ('Alpha', 'Beta') AND Tags__c EXCLUDES ('O\\'Reilly')",
    );
  });

  it("compiles semicolon-delimited multi-select values as AND semantics", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Tags__c", "includes", soqlMultiSelectAnd("Alpha", "Beta"))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE Tags__c INCLUDES ('Alpha;Beta')",
    );
  });

  it("compiles mixed multipicklist AND/OR groups", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Tags__c", "includes", [
        soqlMultiSelectAnd("Alpha", "Beta"),
        "O'Reilly",
      ])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Account WHERE Tags__c INCLUDES ('Alpha;Beta', 'O\\'Reilly')",
    );
  });
});
