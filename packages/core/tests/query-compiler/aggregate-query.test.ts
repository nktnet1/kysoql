import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SalesforceField, SalesforceObject } from "#/schema";

type AggregatableField<
  Value,
  SalesforceType extends string,
  Nullable extends boolean,
> = SalesforceField<
  Value,
  SalesforceType,
  Nullable,
  true,
  true,
  true,
  never,
  never,
  never,
  true
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: AggregatableField<string, "id", false>;
    readonly Name: AggregatableField<string, "string", true>;
    readonly AnnualRevenue: AggregatableField<number, "currency", true>;
    readonly EmployeeCount__c: AggregatableField<number, "int", true>;
    readonly CloseDate: AggregatableField<string, "date", true>;
  }>;
}

describe("aggregate query compilation", () => {
  it("compiles the aggregate selection function family and aliases", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.count("Id").as("rowCount"),
        fn.countDistinct("Name").as("distinctNames"),
        fn.sum("AnnualRevenue").as("totalRevenue"),
        fn.avg("EmployeeCount__c").as("averageEmployees"),
        fn.min("CloseDate").as("firstCloseDate"),
        fn.max("Name").as("lastName"),
      ])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, COUNT_DISTINCT(Name) distinctNames, SUM(AnnualRevenue) totalRevenue, AVG(EmployeeCount__c) averageEmployees, MIN(CloseDate) firstCloseDate, MAX(Name) lastName FROM Account",
    );
  });

  it("compiles bare COUNT() without a generated result alias", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .compile();

    expect(compiled.soql).toBe("SELECT COUNT() FROM Account");
  });
});
