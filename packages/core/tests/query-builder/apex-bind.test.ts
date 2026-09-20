import { describe, expect, expectTypeOf, it } from "vitest";

import { apexAdd, apexBind, apexQueryField, apexSubstring } from "#/apex-bind";
import { Kysoql } from "#/kysoql";
import type { ApexSelectQueryBuilder } from "#/query-builder/apex-select-query-builder";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
  SalesforceQueryResult,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

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
  readonly Account: SalesforceObject<
    {
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
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly Contact: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly LastName: Field;
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
  readonly KnowledgeArticleVersion: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly PublishStatus: Field<string, "picklist">;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly FAQ__kav: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly PublishStatus: Field<string, "picklist">;
  }>;
}

type ApexOutputOf<Query> =
  Query extends ApexSelectQueryBuilder<
    infer _DB,
    infer _TB,
    infer Output,
    infer _Mode
  >
    ? Output
    : never;

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

  it("compiles structured Apex addition bind expressions", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", apexAdd("x", "xx"))
      .where(
        "Name",
        "like",
        apexAdd(
          apexBind<string>("filters.prefix"),
          apexAdd("%", apexBind<string>("filters.suffix")),
        ),
      )
      .limit(apexAdd(apexBind<number>("page.baseLimit"), 1))
      .offset(apexAdd(2, 3));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = :('x' + 'xx') AND Name LIKE :(filters.prefix + ('%' + filters.suffix)) LIMIT :(page.baseLimit + 1) OFFSET :(2 + 3)",
    );
  });

  it("compiles structured Apex substring bind expressions", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", apexSubstring("XXXX", 0, 3))
      .where(
        "Name",
        "like",
        apexAdd(apexSubstring(apexBind<string>("filters.name"), 0, 2), "%"),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = :'XXXX'.substring(0, 3) AND Name LIKE :(filters.name.substring(0, 2) + '%')",
    );
  });

  it("treats substring expressions as binds for Knowledge articles", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .where("PublishStatus", "=", apexSubstring("Draft", 0, 5));

    expect(() => query.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
  });

  it("keeps substring expressions typed and Apex-only", () => {
    const normal = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const apex = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();

    void (() => {
      // @ts-expect-error Structured method bind expressions require the explicit Apex context.
      normal.where("Name", "=", apexSubstring("XXXX", 0, 3));

      apex.where("Name", "=", apexSubstring("XXXX", 0, 3));
      apex.where(
        "Name",
        "like",
        apexAdd(apexSubstring(apexBind<string>("name"), 0, 2), "%"),
      );

      // @ts-expect-error Substring receivers must be string-valued.
      apexSubstring(apexBind<number>("amount"), 0, 1);
      // @ts-expect-error String-valued substring binds must still match the field value type.
      apex.where("AnnualRevenue", ">=", apexSubstring("123", 0, 2));
      // @ts-expect-error LIMIT binds must be numeric, not string-valued method results.
      apex.limit(apexSubstring("123", 0, 2));
    });
  });

  it("compiles structured Apex query-result field bind expressions", () => {
    const sourceAccount = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Name")
      .apex()
      .where("Id", "=", apexBind<string>("sourceAccount.Id"));
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", apexQueryField(sourceAccount, "Name"));

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = :[SELECT Name FROM Account WHERE Id = :sourceAccount.Id].Name",
    );
  });

  it("recursively validates binds inside Apex query-result expressions", () => {
    const knowledgeStatus = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("PublishStatus")
      .apex()
      .where("PublishStatus", "=", apexBind<string>("status"));
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where(
        "Name",
        "=",
        apexAdd(apexQueryField(knowledgeStatus, "PublishStatus"), ""),
      );

    expect(() => query.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
  });

  it("keeps query-result field expressions typed and Apex-only", () => {
    const normal = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");
    const apex = normal.apex();
    const nameSource = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Name")
      .apex();
    const revenueSource = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("AnnualRevenue")
      .apex();
    const apiSource = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Name");
    const functionSource = nameSource as unknown as ApexSelectQueryBuilder<
      FixtureSchema,
      "Account",
      { readonly total: number },
      "function"
    >;

    void (() => {
      const name = apexQueryField(nameSource, "Name");
      apex.where("Name", "=", name);
      apex.where(
        "AnnualRevenue",
        "=",
        apexQueryField(revenueSource, "AnnualRevenue"),
      );

      // @ts-expect-error Structured query-result binds require the explicit Apex context.
      normal.where("Name", "=", name);
      // @ts-expect-error The nested query itself must be an Apex select builder.
      apexQueryField(apiSource, "Name");
      // @ts-expect-error The accessed field must be present in the nested query output.
      apexQueryField(nameSource, "Id");
      // @ts-expect-error Query-result field access requires a plain-mode sObject query.
      apexQueryField(functionSource, "total");
      // @ts-expect-error Query-result field values must still match the outer field value type.
      apex.where("AnnualRevenue", ">=", name);
      const nullableRevenue = apexQueryField(
        revenueSource,
        "AnnualRevenue",
      );
      // @ts-expect-error Nullable query-result values cannot satisfy ordered non-null operands.
      apex.where("AnnualRevenue", ">=", nullableRevenue);
      // @ts-expect-error Nullable query-result values cannot be used as LIMIT binds.
      apex.limit(apexQueryField(revenueSource, "AnnualRevenue"));
    });
  });

  it("creates frozen query-result nodes and validates accessed field names", () => {
    const sourceAccount = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Name")
      .apex();
    const result = apexQueryField(sourceAccount, "Name");
    const node = result.toOperationNode();

    expect(node).toEqual({
      kind: "ApexQueryResultNode",
      query: sourceAccount.toOperationNode(),
      field: "Name",
      cardinality: "single",
    });
    expect(Object.isFrozen(node)).toBe(true);
    if (node.kind === "ApexQueryResultNode") {
      expect(Object.isFrozen(node.query)).toBe(true);
    }

    expect(() =>
      apexQueryField(sourceAccount, "Name; DELETE" as "Name"),
    ).toThrow(
      "Apex query-result fields must be simple selected field names containing only letters, numbers, and underscores, and must not start with a number.",
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

  it("compiles bind-left INCLUDES filters", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where(apexBind<string>("filters.accountType"), "includes", [
        "Customer - Direct; Customer - Channel",
      ])
      .where((eb) =>
        eb.or([
          eb(apexBind<string>("filters.partnerType"), "includes", ["Partner"]),
          eb("Name", "=", "Acme"),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE :filters.accountType INCLUDES ('Customer - Direct; Customer - Channel') AND (:filters.partnerType INCLUDES ('Partner') OR Name = 'Acme')",
    );
  });

  it("validates bind-left INCLUDES literal lists", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex();

    expect(() =>
      query.where(apexBind<string>("accountType"), "includes", []),
    ).toThrow(
      "SOQL INCLUDES/EXCLUDES value lists must contain at least one value.",
    );
  });

  it("compiles Apex binds inside parent-to-child relationship subqueries", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName"])
          .where("LastName", "like", apexBind<string>("filters.lastName"))
          .where("Id", "in", apexBind<readonly string[]>("filters.contactIds"))
          .where((eb) =>
            eb.or([
              eb("LastName", "=", apexBind<string>("filters.firstName")),
              eb("LastName", "=", "Smith"),
            ]),
          )
          .where(apexBind<string>("filters.contactType"), "includes", [
            "Primary",
          ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, LastName FROM Contacts WHERE LastName LIKE :filters.lastName AND Id IN :filters.contactIds AND (LastName = :filters.firstName OR LastName = 'Smith') AND :filters.contactType INCLUDES ('Primary')) FROM Account",
    );
    expectTypeOf<Simplify<ApexOutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
        readonly LastName: string;
      }>;
    }>();
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

  it("creates frozen structured Apex addition nodes", () => {
    const addition = apexAdd(
      "O'Brien",
      apexAdd(apexBind<string>("filters.suffix"), "!"),
    );
    const node = addition.toOperationNode();

    expect(node).toEqual({
      kind: "ApexAdditionNode",
      leftOperand: { kind: "ApexLiteralNode", value: "O'Brien" },
      rightOperand: {
        kind: "ApexAdditionNode",
        leftOperand: { kind: "ApexBindNode", name: "filters.suffix" },
        rightOperand: { kind: "ApexLiteralNode", value: "!" },
      },
    });
    expect(Object.isFrozen(node)).toBe(true);
    if (node.kind === "ApexAdditionNode") {
      expect(Object.isFrozen(node.leftOperand)).toBe(true);
      expect(Object.isFrozen(node.rightOperand)).toBe(true);
    }

    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .where("Name", "=", addition);

    expect(query.compile().soql).toBe(
      "SELECT Id FROM Account WHERE Name = :('O\\'Brien' + (filters.suffix + '!'))",
    );
  });

  it("creates frozen substring nodes and validates literal indexes", () => {
    const substring = apexSubstring(apexAdd("AB", "CD"), 1, 3);
    const node = substring.toOperationNode();

    expect(node).toEqual({
      kind: "ApexSubstringNode",
      source: {
        kind: "ApexAdditionNode",
        leftOperand: { kind: "ApexLiteralNode", value: "AB" },
        rightOperand: { kind: "ApexLiteralNode", value: "CD" },
      },
      beginIndex: 1,
      endIndex: 3,
    });
    expect(Object.isFrozen(node)).toBe(true);
    if (node.kind === "ApexSubstringNode") {
      expect(Object.isFrozen(node.source)).toBe(true);
    }

    expect(() => apexSubstring("XXXX", -1, 3)).toThrow(
      "Apex substring indexes must be non-negative integers, and endIndex must be greater than or equal to beginIndex.",
    );
    expect(() => apexSubstring("XXXX", 0.5, 3)).toThrow(
      "Apex substring indexes must be non-negative integers, and endIndex must be greater than or equal to beginIndex.",
    );
    expect(() => apexSubstring("XXXX", 3, 2)).toThrow(
      "Apex substring indexes must be non-negative integers, and endIndex must be greater than or equal to beginIndex.",
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
    const bindLeftQuery = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .where(apexBind<string>("articleType"), "includes", ["FAQ"]);
    const relationshipQuery = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .where("LastName", "=", apexBind<string>("lastName")),
      );
    const additionQuery = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .apex()
      .where("PublishStatus", "=", apexAdd("Dra", "ft"));

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
    expect(() => bindLeftQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => relationshipQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
    expect(() => additionQuery.compile()).toThrow(
      "Apex SOQL bind expressions are not supported for KnowledgeArticleVersion objects.",
    );
  });

  it("keeps bind expressions typed and Apex-only", () => {
    const typeAssertions = () => {
      const db = new Kysoql<FixtureSchema>();
      const normal = db.selectFrom("Account").select("Id");

      // @ts-expect-error Bind expressions require the explicit Apex context.
      normal.where("Name", "=", apexBind<string>("accountName"));
      // @ts-expect-error Structured bind expressions require the explicit Apex context.
      normal.where("Name", "=", apexAdd("x", "xx"));
      // @ts-expect-error Bind-left INCLUDES requires the explicit Apex context.
      normal.where(apexBind<string>("accountType"), "includes", ["Partner"]);

      // @ts-expect-error LIMIT binds require the explicit Apex context.
      normal.limit(apexBind<number>("rowLimit"));
      // @ts-expect-error OFFSET binds require the explicit Apex context.
      normal.offset(apexBind<number>("rowOffset"));
      normal.selectSubquery("Contacts", (contacts) => {
        // @ts-expect-error Relationship-subquery binds require the explicit Apex context.
        contacts.where("LastName", "=", apexBind<string>("lastName"));
        // @ts-expect-error Bind-left relationship-subquery filters are Apex-only.
        contacts.where(apexBind<string>("contactType"), "includes", [
          "Primary",
        ]);

        return contacts.select("Id");
      });

      const apex = normal.apex();
      apex.where("Name", "=", apexBind<string>("accountName"));
      apex.where("Id", "in", apexBind<readonly string[]>("accountIds"));
      apex.where("CreatedDate", ">", apexBind<string>("createdAfter"));
      apex.where("Name", "=", apexAdd("x", "xx"));
      apex.where(
        "AnnualRevenue",
        ">=",
        apexAdd(apexBind<number>("minimumRevenue"), 1),
      );
      apex.where(apexBind<string>("accountType"), "includes", ["Partner"]);
      apex.where((eb) =>
        eb.or([
          eb("Name", "=", apexBind<string>("firstName")),
          eb("Name", "=", apexBind<string>("secondName")),
          eb(apexBind<string>("accountType"), "includes", ["Partner"]),
        ]),
      );
      apex.limit(apexBind<number>("rowLimit"));
      apex.offset(apexBind<number>("rowOffset"));
      apex.limit(apexAdd(apexBind<number>("baseLimit"), 1));
      apex.offset(apexAdd(5, 5));
      apex.selectSubquery("Contacts", (contacts) => {
        contacts.where("LastName", "=", apexBind<string>("lastName"));
        contacts.where("Id", "in", apexBind<readonly string[]>("contactIds"));
        contacts.where(apexBind<string>("contactType"), "includes", [
          "Primary",
        ]);
        contacts.where((eb) =>
          eb.and([
            eb("LastName", "=", apexBind<string>("firstName")),
            eb("LastName", "!=", apexBind<string>("excludedName")),
          ]),
        );

        // @ts-expect-error Relationship subqueries still reject semi-joins in Apex mode.
        contacts.where("AccountId", "in", () => null as never);

        return contacts.select("Id");
      });

      // @ts-expect-error Apex addition operands must have the same supported value type.
      apexAdd("x", 1);
      // @ts-expect-error Apex addition operands must have the same supported value type.
      apexAdd(apexBind<string>("prefix"), 1);
      // @ts-expect-error Structured scalar binds must still match the field value type.
      apex.where("Name", "=", apexAdd(1, 2));
      // @ts-expect-error Field-left INCLUDES still rejects structured right-hand binds.
      apex.where("Tags__c", "includes", apexAdd("A", "B"));

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
      // @ts-expect-error Bind-left INCLUDES requires a string-valued bind.
      apex.where(apexBind<number>("accountType"), "includes", ["Partner"]);
      // @ts-expect-error Bind-left EXCLUDES is not documented for static Apex SOQL.
      apex.where(apexBind<string>("accountType"), "excludes", ["Former"]);
      // @ts-expect-error Bind-left expressions do not support scalar operators.
      apex.where(apexBind<string>("accountType"), "=", ["Partner"]);
      // @ts-expect-error Bind-left INCLUDES requires string literal lists.
      apex.where(apexBind<string>("accountType"), "includes", [1]);
      // @ts-expect-error Right-hand binds are not supported with INCLUDES/EXCLUDES.
      apex.where("Tags__c", "includes", apexBind<readonly string[]>("tags"));
      const unfilterableValue = apexBind<string>("unfilterableValue");
      // @ts-expect-error Apex filters still require generated filterable metadata.
      apex.where("Unfilterable__c", "=", unfilterableValue);
    };

    expect(typeAssertions).toBeTypeOf("function");
  });
});
