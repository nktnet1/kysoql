import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#/schema";

type Field<Value = string, Type extends string = "string"> = SalesforceField<
  Value,
  Type,
  false,
  true,
  true,
  true,
  never,
  never,
  never,
  true
>;

type DataCategoryFixture = {
  readonly Geography__c:
    | "All"
    | "asia__c"
    | "europe__c"
    | "france__c"
    | "uk__c"
    | "usa__c";
  readonly Product__c: "All" | "dsl__c" | "mobile_phones__c";
  readonly Audience__c: "All" | "internal__c";
  readonly Language__c: "All" | "english__c";
};

interface FixtureSchema {
  readonly KnowledgeArticleVersion: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Title: Field;
      readonly PublishStatus: Field<string, "picklist">;
    },
    {},
    {
      readonly Children__r: SalesforceChildRelationship<
        "ArticleChild__c",
        "Article__c"
      >;
    },
    never,
    DataCategoryFixture
  >;
  readonly FAQ__kav: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Title: Field;
      readonly PublishStatus: Field<string, "picklist">;
    },
    {},
    {},
    never,
    DataCategoryFixture
  >;
  readonly Question: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Title: Field;
    },
    {},
    {},
    never,
    DataCategoryFixture
  >;
  readonly ArticleChild__c: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Article__c: SalesforceField<
      string,
      "reference",
      false,
      true,
      true,
      true,
      "KnowledgeArticleVersion",
      "Article"
    >;
  }>;
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
  }>;
}

describe("WITH DATA CATEGORY", () => {
  it("compiles typed single-category selectors after WHERE", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select(["Id", "Title"])
      .where("PublishStatus", "=", "Online")
      .withDataCategory("Geography__c", "above", "usa__c");

    expect(query.compile().soql).toBe(
      "SELECT Id, Title FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' WITH DATA CATEGORY Geography__c ABOVE usa__c",
    );
  });

  it("requires Knowledge article queries to filter by PublishStatus or Id", () => {
    const db = new Kysoql<FixtureSchema>();
    const article = db
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .withDataCategory("Geography__c", "at", "usa__c");

    expect(() => article.compile()).toThrow(
      "SOQL WITH DATA CATEGORY queries on Knowledge articles require a WHERE predicate on PublishStatus or Id.",
    );
    expect(() => article.where("Title", "=", "Example").compile()).toThrow(
      "SOQL WITH DATA CATEGORY queries on Knowledge articles require a WHERE predicate on PublishStatus or Id.",
    );

    expect(article.where("Id", "=", "ka0000000000001").compile().soql).toBe(
      "SELECT Id FROM KnowledgeArticleVersion WHERE Id = 'ka0000000000001' WITH DATA CATEGORY Geography__c AT usa__c",
    );

    const nested = article.where((eb) =>
      eb.or([eb("Title", "=", "Example"), eb("PublishStatus", "=", "Online")]),
    );

    expect(nested.compile().soql).toBe(
      "SELECT Id FROM KnowledgeArticleVersion WHERE (Title = 'Example' OR PublishStatus = 'Online') WITH DATA CATEGORY Geography__c AT usa__c",
    );
  });

  it("applies the WHERE prerequisite to article types but not Question", () => {
    const db = new Kysoql<FixtureSchema>();
    const articleType = db
      .selectFrom("FAQ__kav")
      .select("Id")
      .withDataCategory("Geography__c", "below", "europe__c");
    const question = db
      .selectFrom("Question")
      .select("Id")
      .withDataCategory("Geography__c", "above", "usa__c");

    expect(() => articleType.compile()).toThrow(
      "SOQL WITH DATA CATEGORY queries on Knowledge articles require a WHERE predicate on PublishStatus or Id.",
    );
    expect(
      articleType.where("PublishStatus", "=", "Online").compile().soql,
    ).toBe(
      "SELECT Id FROM FAQ__kav WHERE PublishStatus = 'Online' WITH DATA CATEGORY Geography__c BELOW europe__c",
    );
    expect(question.compile().soql).toBe(
      "SELECT Id FROM Question WITH DATA CATEGORY Geography__c ABOVE usa__c",
    );
  });

  it("compiles multiple categories and conditions with every selector", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .where("PublishStatus", "=", "Online")
      .withDataCategory("Geography__c", "at", ["usa__c", "france__c"])
      .withDataCategory("Product__c", "below", "mobile_phones__c")
      .withDataCategory("Audience__c", "above_or_below", "internal__c");

    expect(query.compile().soql).toBe(
      "SELECT Id FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' WITH DATA CATEGORY Geography__c AT (usa__c, france__c) AND Product__c BELOW mobile_phones__c AND Audience__c ABOVE_OR_BELOW internal__c",
    );
  });

  it("preserves root clause ordering regardless of builder call order", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .orderBy("Title", "desc")
      .limit(20)
      .offset(5)
      .withDataCategory("Geography__c", "below", "europe__c")
      .where("PublishStatus", "=", "Online");

    expect(query.compile().soql).toBe(
      "SELECT Id FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' WITH DATA CATEGORY Geography__c BELOW europe__c ORDER BY Title DESC LIMIT 20 OFFSET 5",
    );
  });

  it("retains data-category filtering across aggregate and COUNT() builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregateQuery = db
      .selectFrom("KnowledgeArticleVersion")
      .select(({ fn }) => fn.count("Id").as("articleCount"))
      .withDataCategory("Geography__c", "at", "usa__c")
      .groupBy("PublishStatus")
      .select("PublishStatus")
      .where("PublishStatus", "=", "Online")
      .having((eb) => eb(eb.fn.count("Id"), ">", 0));
    const countQuery = db
      .selectFrom("KnowledgeArticleVersion")
      .select(({ fn }) => fn.count())
      .withDataCategory("Product__c", "above", "dsl__c")
      .where("PublishStatus", "=", "Online")
      .limit(100);

    expect(aggregateQuery.compile().soql).toBe(
      "SELECT COUNT(Id) articleCount, PublishStatus FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' WITH DATA CATEGORY Geography__c AT usa__c GROUP BY PublishStatus HAVING COUNT(Id) > 0",
    );
    expect(countQuery.compile().soql).toBe(
      "SELECT COUNT() FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' WITH DATA CATEGORY Product__c ABOVE dsl__c LIMIT 100",
    );
  });

  it("builds immutable category state and rejects duplicate groups or a fourth condition", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id");
    const one = base.withDataCategory("Geography__c", "at", "usa__c");
    const two = one.withDataCategory("Product__c", "below", "dsl__c");
    const three = two.withDataCategory(
      "Audience__c",
      "above_or_below",
      "internal__c",
    );

    expect(base.toOperationNode().withDataCategory).toBeUndefined();
    expect(one.toOperationNode().withDataCategory?.selections).toHaveLength(1);
    expect(two.toOperationNode().withDataCategory?.selections).toHaveLength(2);
    expect(three.toOperationNode().withDataCategory?.selections).toHaveLength(
      3,
    );
    expect(Object.isFrozen(three.toOperationNode().withDataCategory)).toBe(
      true,
    );
    expect(
      Object.isFrozen(three.toOperationNode().withDataCategory?.selections),
    ).toBe(true);

    expect(() =>
      one.withDataCategory("Geography__c", "below", "europe__c"),
    ).toThrow(
      "SOQL WITH DATA CATEGORY cannot use the same category group more than once: Geography__c.",
    );
    expect(() =>
      three.withDataCategory("Language__c", "at", "english__c"),
    ).toThrow("SOQL WITH DATA CATEGORY supports at most three conditions.");
  });

  it("validates unsafe runtime inputs before creating operation nodes", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id");

    expect(() =>
      query.withDataCategory("not valid" as never, "at", "usa__c" as never),
    ).toThrow("SOQL WITH DATA CATEGORY group must be a Salesforce API name.");
    expect(() =>
      query.withDataCategory("Geography__c", "sideways" as never, "usa__c"),
    ).toThrow(
      "SOQL WITH DATA CATEGORY selector must be at, above, below, or above_or_below.",
    );
    expect(() =>
      query.withDataCategory("Geography__c", "at", [] as never),
    ).toThrow("SOQL WITH DATA CATEGORY requires at least one category name.");
    expect(() =>
      query.withDataCategory("Geography__c", "at", ["not valid"] as never),
    ).toThrow(
      "SOQL WITH DATA CATEGORY category must be a Salesforce API name.",
    );
  });

  it("revalidates data-category invariants at the compiler boundary", () => {
    const baseNode = new Kysoql<FixtureSchema>()
      .selectFrom("KnowledgeArticleVersion")
      .select("Id")
      .toOperationNode();
    const compiler = new DefaultQueryCompiler();

    expect(() =>
      compiler.compileQuery({
        ...baseNode,
        withDataCategory: {
          kind: "WithDataCategoryNode",
          selections: [
            {
              kind: "DataCategorySelectionNode",
              group: "Geography__c",
              selector: "at",
              categories: ["usa__c"],
            },
            {
              kind: "DataCategorySelectionNode",
              group: "Geography__c",
              selector: "below",
              categories: ["europe__c"],
            },
          ],
        },
      }),
    ).toThrow(
      "SOQL WITH DATA CATEGORY cannot use the same category group more than once: Geography__c.",
    );

    expect(() =>
      compiler.compileQuery({
        ...baseNode,
        withDataCategory: {
          kind: "WithDataCategoryNode",
          selections: [],
        },
      }),
    ).toThrow(
      "SOQL WITH DATA CATEGORY supports between one and three conditions.",
    );
  });

  it("restricts groups and categories to generated metadata and omits child-query support", () => {
    const db = new Kysoql<FixtureSchema>();
    const article = db.selectFrom("KnowledgeArticleVersion");
    const account = db.selectFrom("Account");

    void (() => {
      article.withDataCategory("Geography__c", "at", "usa__c");
      article.withDataCategory("Geography__c", "at", ["usa__c", "france__c"]);

      // @ts-expect-error Category groups are object-specific generated metadata.
      article.withDataCategory("Unknown__c", "at", "usa__c");
      // @ts-expect-error Categories are scoped to their generated category group.
      article.withDataCategory("Product__c", "at", "usa__c");
      // @ts-expect-error Selector names are restricted to Salesforce grammar.
      article.withDataCategory("Geography__c", "sideways", "usa__c");
      // @ts-expect-error Objects without data-category metadata expose no valid groups.
      account.withDataCategory("Geography__c", "at", "usa__c");
    });

    article.selectSubquery("Children__r", (children) => {
      void (() => {
        // @ts-expect-error WITH DATA CATEGORY is a top-level SELECT clause.
        children.withDataCategory("Geography__c", "at", "usa__c");
      });
      return children.select("Id");
    });
  });
});
