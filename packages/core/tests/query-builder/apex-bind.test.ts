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

  it("creates frozen bind nodes and validates bind identifiers", () => {
    const binding = apexBind<string>("accountName");

    expect(binding.toOperationNode()).toEqual({
      kind: "ApexBindNode",
      name: "accountName",
    });
    expect(Object.isFrozen(binding.toOperationNode())).toBe(true);
    expect(() => apexBind<string>("account.Name")).toThrow(
      "Apex bind names must be simple identifiers containing only letters, numbers, and underscores, and must not start with a number.",
    );
    expect(() => apexBind<string>("1accountName")).toThrow(
      "Apex bind names must be simple identifiers containing only letters, numbers, and underscores, and must not start with a number.",
    );
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

    expect(() => query.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => customQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
  });

  it("keeps bind expressions typed and Apex-only", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FixtureSchema>();
      const normal = db.selectFrom("Account").select("Id");

      // @ts-expect-error Bind expressions require the explicit Apex context.
      normal.where("Name", "=", apexBind<string>("accountName"));

      const apex = normal.apex();
      apex.where("Name", "=", apexBind<string>("accountName"));
      apex.where("Id", "in", apexBind<readonly string[]>("accountIds"));
      apex.where("CreatedDate", ">", apexBind<string>("createdAfter"));

      // @ts-expect-error Scalar field binds must match the field value type.
      apex.where("Name", "=", apexBind<number>("accountName"));
      // @ts-expect-error IN binds must represent a collection of field values.
      apex.where("Id", "in", apexBind<string>("accountIds"));
      // @ts-expect-error Scalar operators do not accept collection binds.
      apex.where("Name", "=", apexBind<readonly string[]>("accountNames"));
      // @ts-expect-error Bind expressions are not supported with INCLUDES/EXCLUDES.
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
