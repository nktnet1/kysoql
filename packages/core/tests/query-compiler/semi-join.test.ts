import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

interface SemiJoinCompilerSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
  }>;
  readonly Contact: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly AccountId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "Account"
    >;
    readonly LastName: SalesforceField<string, "string", false, true, true, true>;
  }>;
  readonly Opportunity: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly AccountId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "Account"
    >;
    readonly StageName: SalesforceField<
      string,
      "picklist",
      false,
      true,
      true,
      true
    >;
  }>;
}

describe("semi-join and anti-join compilation", () => {
  it("compiles typed IN/NOT IN subqueries alongside scalar IN lists", () => {
    const compiled = new Kysoql<SemiJoinCompilerSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .select("AccountId")
          .where("StageName", "=", "Closed Won"),
      )
      .where("Id", "not in", (subquery) =>
        subquery
          .selectFrom("Contact")
          .select("AccountId")
          .where("LastName", "like", "Test%"),
      )
      .where("Name", "in", ["Acme", "Global Media"])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id, Name FROM Account WHERE Id IN (SELECT AccountId FROM Opportunity WHERE StageName = 'Closed Won') AND Id NOT IN (SELECT AccountId FROM Contact WHERE LastName LIKE 'Test%') AND Name IN ('Acme', 'Global Media')",
    );
  });

  it("compiles reference-field semi-joins against a matching object ID", () => {
    const compiled = new Kysoql<SemiJoinCompilerSchema>()
      .selectFrom("Opportunity")
      .select("Id")
      .where("AccountId", "in", (subquery) =>
        subquery.selectFrom("Account").select("Id").where("Name", "like", "A%"),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Id FROM Opportunity WHERE AccountId IN (SELECT Id FROM Account WHERE Name LIKE 'A%')",
    );
  });
});
