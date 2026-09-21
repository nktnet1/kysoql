import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";
import { soqlDate } from "#/soql-temporal-literal";

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
  readonly Account: SalesforceObject<
    {
      readonly Id: AggregatableField<string, "id", false>;
      readonly Name: AggregatableField<string, "string", true>;
      readonly AnnualRevenue: AggregatableField<number, "currency", true>;
      readonly EmployeeCount__c: AggregatableField<number, "int", true>;
      readonly CloseDate: AggregatableField<string, "date", true>;
      readonly CreatedDate: AggregatableField<string, "datetime", false>;
      readonly OwnerId: AggregatableField<string, "reference", false>;
      readonly CustomOwner__c: AggregatableField<
        string,
        "reference",
        true
      >;
    },
    {
      readonly Owner: SalesforceParentRelationship<"User", "OwnerId", true>;
      readonly CustomOwner__r: SalesforceParentRelationship<
        "User",
        "CustomOwner__c",
        true
      >;
    }
  >;
  readonly User: SalesforceObject<{
    readonly CreatedDate: AggregatableField<string, "datetime", false>;
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

  it("compiles GROUP BY without an aggregate selection", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .groupBy("Name")
      .select("Name")
      .orderBy("Name")
      .limit(10)
      .compile();

    expect(compiled.soql).toBe(
      "SELECT Name FROM Account GROUP BY Name ORDER BY Name LIMIT 10",
    );
  });

  it("rejects custom relationship expressions in grouped queries at compile time", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("CustomOwner__r.Name" as never);

    expect(() => query.compile()).toThrow(
      "SOQL queries using GROUP BY cannot use custom relationship expressions with __r.",
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

  it("compiles row-producing aggregate functions in ORDER BY", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("Name")
      .select("Name")
      .orderBy(({ fn }) => fn.count("Id"), "desc")
      .orderBy(({ fn }) => fn.countDistinct("Name"))
      .orderBy(({ fn }) => fn.avg("AnnualRevenue"), undefined, "last")
      .orderBy(({ fn }) => fn.min("CloseDate"))
      .orderBy(({ fn }) => fn.max("Owner.Name"), "asc", "first")
      .orderBy(({ fn }) => fn.sum("AnnualRevenue"), "desc")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, Name FROM Account GROUP BY Name ORDER BY COUNT(Id) DESC, COUNT_DISTINCT(Name), AVG(AnnualRevenue) NULLS LAST, MIN(CloseDate), MAX(Owner.Name) ASC NULLS FIRST, SUM(AnnualRevenue) DESC",
    );
  });

  it("compiles the complete date grouping function family", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.calendarMonth("CloseDate"))
      .groupBy(({ fn }) => fn.calendarQuarter("CloseDate"))
      .groupBy(({ fn }) => fn.calendarYear("CloseDate"))
      .groupBy(({ fn }) => fn.dayInMonth("CloseDate"))
      .groupBy(({ fn }) => fn.dayInWeek("CloseDate"))
      .groupBy(({ fn }) => fn.dayInYear("CloseDate"))
      .groupBy(({ fn }) => fn.dayOnly("CreatedDate"))
      .groupBy(({ fn }) => fn.fiscalMonth("CloseDate"))
      .groupBy(({ fn }) => fn.fiscalQuarter("CloseDate"))
      .groupBy(({ fn }) => fn.fiscalYear("CloseDate"))
      .groupBy(({ fn }) => fn.hourInDay("CreatedDate"))
      .groupBy(({ fn }) => fn.weekInMonth("CloseDate"))
      .groupBy(({ fn }) => fn.weekInYear("CloseDate"))
      .select(({ fn }) => [
        fn.calendarMonth("CloseDate").as("calendarMonth"),
        fn.calendarQuarter("CloseDate").as("calendarQuarter"),
        fn.calendarYear("CloseDate").as("calendarYear"),
        fn.dayInMonth("CloseDate").as("dayInMonth"),
        fn.dayInWeek("CloseDate").as("dayInWeek"),
        fn.dayInYear("CloseDate").as("dayInYear"),
        fn.dayOnly("CreatedDate").as("dayOnly"),
        fn.fiscalMonth("CloseDate").as("fiscalMonth"),
        fn.fiscalQuarter("CloseDate").as("fiscalQuarter"),
        fn.fiscalYear("CloseDate").as("fiscalYear"),
        fn.hourInDay("CreatedDate").as("hourInDay"),
        fn.weekInMonth("CloseDate").as("weekInMonth"),
        fn.weekInYear("CloseDate").as("weekInYear"),
      ])
      .having((eb) => eb(eb.fn.calendarYear("CloseDate"), ">=", 2020))
      .orderBy(({ fn }) => fn.dayOnly("CreatedDate"), "desc")
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, CALENDAR_MONTH(CloseDate) calendarMonth, CALENDAR_QUARTER(CloseDate) calendarQuarter, CALENDAR_YEAR(CloseDate) calendarYear, DAY_IN_MONTH(CloseDate) dayInMonth, DAY_IN_WEEK(CloseDate) dayInWeek, DAY_IN_YEAR(CloseDate) dayInYear, DAY_ONLY(CreatedDate) dayOnly, FISCAL_MONTH(CloseDate) fiscalMonth, FISCAL_QUARTER(CloseDate) fiscalQuarter, FISCAL_YEAR(CloseDate) fiscalYear, HOUR_IN_DAY(CreatedDate) hourInDay, WEEK_IN_MONTH(CloseDate) weekInMonth, WEEK_IN_YEAR(CloseDate) weekInYear FROM Account GROUP BY CALENDAR_MONTH(CloseDate), CALENDAR_QUARTER(CloseDate), CALENDAR_YEAR(CloseDate), DAY_IN_MONTH(CloseDate), DAY_IN_WEEK(CloseDate), DAY_IN_YEAR(CloseDate), DAY_ONLY(CreatedDate), FISCAL_MONTH(CloseDate), FISCAL_QUARTER(CloseDate), FISCAL_YEAR(CloseDate), HOUR_IN_DAY(CreatedDate), WEEK_IN_MONTH(CloseDate), WEEK_IN_YEAR(CloseDate) HAVING CALENDAR_YEAR(CloseDate) >= 2020 ORDER BY DAY_ONLY(CreatedDate) DESC",
    );
  });

  it("compiles date functions selected from a raw grouped date field", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy("CloseDate")
      .select(({ fn }) => [
        fn.calendarYear("CloseDate").as("closeYear"),
        fn.calendarMonth("CloseDate").as("closeMonth"),
      ])
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, CALENDAR_YEAR(CloseDate) closeYear, CALENDAR_MONTH(CloseDate) closeMonth FROM Account GROUP BY CloseDate",
    );
  });

  it("compiles convertTimezone only as a nested date-function argument", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.calendarYear(fn.convertTimezone("CreatedDate")))
      .groupBy(({ fn }) => fn.dayOnly(fn.convertTimezone("CreatedDate")))
      .groupBy(({ fn }) =>
        fn.hourInDay(fn.convertTimezone("Owner.CreatedDate")),
      )
      .select(({ fn }) => [
        fn.calendarYear(fn.convertTimezone("CreatedDate")).as("localYear"),
        fn.dayOnly(fn.convertTimezone("CreatedDate")).as("localDay"),
        fn
          .hourInDay(fn.convertTimezone("Owner.CreatedDate"))
          .as("localOwnerHour"),
      ])
      .having((eb) =>
        eb(
          eb.fn.calendarYear(eb.fn.convertTimezone("CreatedDate")),
          ">=",
          2020,
        ),
      )
      .orderBy(
        ({ fn }) => fn.dayOnly(fn.convertTimezone("CreatedDate")),
        "desc",
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, CALENDAR_YEAR(convertTimezone(CreatedDate)) localYear, DAY_ONLY(convertTimezone(CreatedDate)) localDay, HOUR_IN_DAY(convertTimezone(Owner.CreatedDate)) localOwnerHour FROM Account GROUP BY CALENDAR_YEAR(convertTimezone(CreatedDate)), DAY_ONLY(convertTimezone(CreatedDate)), HOUR_IN_DAY(convertTimezone(Owner.CreatedDate)) HAVING CALENDAR_YEAR(convertTimezone(CreatedDate)) >= 2020 ORDER BY DAY_ONLY(convertTimezone(CreatedDate)) DESC",
    );
  });

  it("compiles DAY_ONLY HAVING comparisons as date literals", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("rowCount"))
      .groupBy(({ fn }) => fn.dayOnly("CreatedDate"))
      .select(({ fn }) => fn.dayOnly("CreatedDate").as("createdDay"))
      .having((eb) =>
        eb(eb.fn.dayOnly("CreatedDate"), "=", soqlDate("2026-09-18")),
      )
      .compile();

    expect(compiled.soql).toBe(
      "SELECT COUNT(Id) rowCount, DAY_ONLY(CreatedDate) createdDay FROM Account GROUP BY DAY_ONLY(CreatedDate) HAVING DAY_ONLY(CreatedDate) = 2026-09-18",
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
