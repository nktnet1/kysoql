import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";

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
    readonly OwnerId: AggregatableField<string, "reference", false>;
  }, {
    readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
  }>;
  readonly User: SalesforceObject<{
    readonly Name: AggregatableField<string, "string", false>;
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

  it("compiles single and multiple GROUP BY fields in clause order", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .where("Name", "!=", null)
      .groupBy("Name")
      .groupBy("Owner.Name")
      .select(["Name", "Owner.Name"])
      .orderBy("Name", "desc")
      .limit(10)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, Name, Owner.Name FROM Account WHERE Name != null GROUP BY Name, Owner.Name ORDER BY Name DESC LIMIT 10",
    );
  });

  it("compiles additive GROUP BY ROLLUP fields", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByRollup("Name")
      .groupByRollup("Owner.Name")
      .select(["Name", "Owner.Name"])
      .having((eb) => eb(eb.fn.count("Id"), ">", 1))
      .orderBy("Name")
      .limit(10)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, Name, Owner.Name FROM Account GROUP BY ROLLUP(Name, Owner.Name) HAVING COUNT(Id) > 1 ORDER BY Name LIMIT 10",
    );
  });

  it("compiles GROUP BY CUBE fields", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.sum("AnnualRevenue").as("totalRevenue"))
      .groupByCube(["Name", "Owner.Name"])
      .select(["Name", "Owner.Name"])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT SUM(AnnualRevenue) totalRevenue, Name, Owner.Name FROM Account GROUP BY CUBE(Name, Owner.Name)",
    );
  });

  it("compiles HAVING after GROUP BY with aggregate and grouped-field conditions", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => [
        fn.count("Id").as("rowCount"),
        fn.sum("AnnualRevenue").as("totalRevenue"),
      ])
      .where("Name", "!=", null)
      .groupBy("Name")
      .select("Name")
      .having((eb) =>
        eb.and([
          eb(eb.fn.count("Id"), ">", 1),
          eb.or([
            eb("Name", "like", "Acme%"),
            eb.not(eb(eb.fn.sum("AnnualRevenue"), ">=", 1_000)),
          ]),
        ]),
      )
      .orderBy("Name")
      .limit(10)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, SUM(AnnualRevenue) totalRevenue, Name FROM Account WHERE Name != null GROUP BY Name HAVING COUNT(Id) > 1 AND (Name LIKE 'Acme%' OR NOT (SUM(AnnualRevenue) >= 1000)) ORDER BY Name LIMIT 10",
    );
  });

  it("accumulates repeated HAVING calls with AND", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name")
      .select("Name")
      .having("Name", "!=", null)
      .having((eb) => eb(eb.fn.count("Id"), ">", 1))
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, Name FROM Account GROUP BY Name HAVING Name != null AND COUNT(Id) > 1",
    );
  });

  it("compiles GROUPING() in SELECT, HAVING, and ORDER BY", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupByCube(["Name", "Owner.Name"])
      .select(({ fn }) => [
        fn.grouping("Name").as("isNameSubtotal"),
        fn.grouping("Owner.Name").as("isOwnerSubtotal"),
      ])
      .having((eb) => eb(eb.fn.grouping("Name"), "=", 0))
      .orderBy(({ fn }) => fn.grouping("Name"))
      .orderBy(({ fn }) => fn.grouping("Owner.Name"), "desc")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, GROUPING(Name) isNameSubtotal, GROUPING(Owner.Name) isOwnerSubtotal FROM Account GROUP BY CUBE(Name, Owner.Name) HAVING GROUPING(Name) = 0 ORDER BY GROUPING(Name), GROUPING(Owner.Name) DESC",
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
