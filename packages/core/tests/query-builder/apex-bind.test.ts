import { describe, expect, it } from "vitest";

import { apexBind } from "#/apex-bind";
import { Kysoql } from "#/kysoql";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";

type Field<
  Value = string,
  Type extends string = "string",
  Nullable extends boolean = false,
  PicklistValue extends string = never,
> = SalesforceField<
  Value,
  Type,
  Nullable,
  true,
  true,
  true,
  never,
  never,
  PicklistValue
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
    readonly CreatedDate: Field<string, "datetime">;
    readonly AnnualRevenue: Field<number, "currency", true>;
    readonly Unfilterable__c: SalesforceField<
      string,
      "string",
      false,
      false,
      true,
      true
    >;
    readonly Tags__c: Field<string, "multipicklist", false, "A" | "B">;
  }>;
  readonly Contact: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly AccountId: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "Account",
        "Account"
      >;
    },
    {
      readonly Account: SalesforceParentRelationship<
        "Account",
        "AccountId",
        true
      >;
    }
  >;
  readonly KnowledgeArticleVersion: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly PublishStatus: Field<string, "picklist">;
  }>;
  readonly FAQ__kav: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly PublishStatus: Field<string, "picklist">;
  }>;
}

describe("Apex bind expressions", () => {
  it("compiles scalar bind expressions in Apex WHERE filters", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .apex()
      .where("Name", "=", apexBind<string>("accountName"))
      .where("AnnualRevenue", ">=", apexBind<number>("minimumRevenue"));

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name = :accountName AND AnnualRevenue >= :minimumRevenue",
    );
  });

  it("compiles safe dotted Apex member-path binds", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", apexBind<string>("filters.accountName"))
      .where("Id", "in", apexBind<readonly string[]>("filters.accountIds"))
      .limit(apexBind<number>("page.rowLimit"))
      .offset(apexBind<number>("page.rowOffset"));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = :filters.accountName AND Id IN :filters.accountIds LIMIT :page.rowLimit OFFSET :page.rowOffset",
    );
  });

  it("compiles collection binds for IN and NOT IN without literal-list parentheses", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Id", "in", apexBind<readonly string[]>("accountIds"))
      .where("Name", "not in", apexBind<readonly string[]>("excludedNames"));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Id IN :accountIds AND Name NOT IN :excludedNames",
    );
  });

  it("supports grouped Apex WHERE expressions containing binds", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where((eb) =>
        eb.or([
          eb("Name", "=", apexBind<string>("accountName")),
          eb.not(eb("AnnualRevenue", "<", apexBind<number>("minimumRevenue"))),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE (Name = :accountName OR NOT (AnnualRevenue < :minimumRevenue))",
    );
  });

  it("keeps semi-joins top-level when grouped Apex filters use binds", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where((eb) =>
        eb.and([
          eb("Id", "in", (subquery) =>
            subquery.selectFrom("Contact").select("AccountId"),
          ),
          eb("Name", "=", apexBind<string>("accountName")),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Id IN (SELECT AccountId FROM Contact) AND Name = :accountName",
    );
  });

  it("compiles numeric LIMIT and OFFSET binds with replacement semantics", () => {
    const literal = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .limit(25)
      .offset(5);
    const bound = literal
      .limit(apexBind<number>("rowLimit"))
      .offset(apexBind<number>("rowOffset"));

    expect(literal.compile().soql).toBe(
      "SELECT Id FROM Account LIMIT 25 OFFSET 5",
    );
    expect(bound.compile().soql).toBe(
      "SELECT Id FROM Account LIMIT :rowLimit OFFSET :rowOffset",
    );
  });

  it("validates literal Apex LIMIT and OFFSET values", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();

    expect(() => query.limit(-1)).toThrow(
      "SOQL LIMIT must be a non-negative safe integer.",
    );
    expect(() => query.offset(2001)).toThrow(
      "SOQL OFFSET must be a safe integer between 0 and 2000.",
    );
  });

  it("supports relationship and temporal filter binds", () => {
    const relationshipQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Contact")
      .select("Id")
      .apex()
      .where("Account.Name", "like", apexBind<string>("accountPattern"));
    const temporalQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("CreatedDate", ">", apexBind<string>("createdAfter"));

    expect(relationshipQuery.compile().soql).toBe(
      "SELECT Id FROM Contact WHERE Account.Name LIKE :accountPattern",
    );
    expect(temporalQuery.compile().soql).toBe(
      "SELECT Id FROM Account WHERE CreatedDate > :createdAfter",
    );
  });

  it("preserves literal and semi-join filters in the Apex context", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "!=", "")
      .where("Id", "in", (subquery) =>
        subquery.selectFrom("Contact").select("AccountId"),
      )
      .where("Name", "=", apexBind<string>("accountName"));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name != '' AND Id IN (SELECT AccountId FROM Contact) AND Name = :accountName",
    );
  });

  it("creates frozen bind nodes and validates bind expressions", () => {
    const binding = apexBind<string>("accountName");
    const memberBinding = apexBind<string>("context.account.Name");

    expect(binding.toOperationNode()).toEqual({
      kind: "ApexBindNode",
      name: "accountName",
    });
    expect(memberBinding.toOperationNode()).toEqual({
      kind: "ApexBindNode",
      name: "context.account.Name",
    });
    expect(Object.isFrozen(binding.toOperationNode())).toBe(true);
    expect(Object.isFrozen(memberBinding.toOperationNode())).toBe(true);

    const invalidExpressions = [
      "1accountName",
      "account.1Name",
      ".accountName",
      "accountName.",
      "account..Name",
      "account.Name()",
      "accounts[0].Name",
      "accountName + otherName",
      ":accountName",
      " accountName",
      "accountName ",
    ];

    for (const expression of invalidExpressions) {
      expect(() => apexBind<string>(expression)).toThrow(
        "Apex bind expressions must be identifiers or dotted member paths containing only letters, numbers, and underscores, and no path segment can start with a number.",
      );
    }
  });

  it("rejects Apex binds for KnowledgeArticleVersion queries", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .where("PublishStatus", "=", apexBind<string>("publishStatus"));

    const customQuery = new Kysoql<FixtureSchema>()
      .selectFrom("FAQ__kav")
      .select("Id")
      .apex()
      .where("PublishStatus", "=", apexBind<string>("publishStatus"));
    const limitQuery = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .limit(apexBind<number>("rowLimit"));
    const offsetQuery = new Kysoql<FixtureSchema>()
      .selectFrom("FAQ__kav")
      .select("Id")
      .apex()
      .offset(apexBind<number>("rowOffset"));

    expect(() => query.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => customQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => limitQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => offsetQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
  });

  it("keeps bind expressions typed and Apex-only", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FixtureSchema>();
      const normal = db.selectFrom("Account").select("Id");

      // @ts-expect-error Bind expressions require the explicit Apex context.
      normal.where("Name", "=", apexBind<string>("accountName"));

      // @ts-expect-error LIMIT binds require the explicit Apex context.
      normal.limit(apexBind<number>("rowLimit"));
      // @ts-expect-error OFFSET binds require the explicit Apex context.
      normal.offset(apexBind<number>("rowOffset"));

      const apex = normal.apex();
      apex.where("Name", "=", apexBind<string>("accountName"));
      apex.where("Id", "in", apexBind<readonly string[]>("accountIds"));
      apex.where("CreatedDate", ">", apexBind<string>("createdAfter"));
      apex.where((eb) =>
        eb.or([
          eb("Name", "=", apexBind<string>("firstName")),
          eb("Name", "=", apexBind<string>("secondName")),
        ]),
      );
      apex.limit(apexBind<number>("rowLimit"));
      apex.offset(apexBind<number>("rowOffset"));

      // @ts-expect-error LIMIT binds must be numeric.
      apex.limit(apexBind<string>("rowLimit"));
      // @ts-expect-error OFFSET binds must be numeric.
      apex.offset(apexBind<string>("rowOffset"));
      // @ts-expect-error Scalar field binds must match the field value type.
      apex.where("Name", "=", apexBind<number>("accountName"));
      // @ts-expect-error IN binds must represent a collection of field values.
      apex.where("Id", "in", apexBind<string>("accountIds"));
      // @ts-expect-error Scalar operators do not accept collection binds.
      apex.where("Name", "=", apexBind<readonly string[]>("accountNames"));
      // @ts-expect-error Right-hand binds are not supported with INCLUDES/EXCLUDES.
      apex.where("Tags__c", "includes", apexBind<readonly string[]>("tags"));
      apex.where(
        // @ts-expect-error Apex filters still require generated filterable metadata.
        "Unfilterable__c",
        "=",
        apexBind<string>("unfilterableValue"),
      );
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
