import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import type { KnowledgeArticleUpdateCheck } from "#/parser/knowledge-update-parser";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
} from "#/schema";

type Field<
  Value = string,
  Type extends string = "string",
> = SalesforceField<Value, Type, false, true, true, true, never, never, never, true>;

type KnowledgeFields = {
  readonly Id: Field<string, "id">;
  readonly Title: Field;
  readonly PublishStatus: Field;
  readonly Language: Field;
  readonly Keyword: Field;
  readonly KnowledgeArticleVersion: Field<string, "id">;
};

interface FixtureSchema {
  readonly KnowledgeArticleVersion: SalesforceObject<KnowledgeFields>;
  readonly FAQ__kav: SalesforceObject<KnowledgeFields, {}, {}, never, {}, true>;
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
  readonly Question: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Title: Field;
  }>;
  readonly Container__c: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
    },
    {},
    {
      readonly Articles: SalesforceChildRelationship<"FAQ__kav", "Container__c">;
    }
  >;
}

describe("Knowledge UPDATE TRACKING and UPDATE VIEWSTAT", () => {
  it("compiles either Knowledge update mode after the normal SELECT clauses", () => {
    const db = new Kysoql<FixtureSchema>();
    const tracking = db
      .selectFrom("FAQ__kav")
      .select("Title")
      .where("Keyword", "=", "Apex")
      .updateTracking();
    const viewstat = db
      .selectFrom("FAQ__kav")
      .updateViewstat()
      .select(["Id", "Title"])
      .where("PublishStatus", "=", "Online")
      .limit(1);

    expect(tracking.compile().soql).toBe(
      "SELECT Title FROM FAQ__kav WHERE Keyword = 'Apex' UPDATE TRACKING",
    );
    expect(viewstat.compile().soql).toBe(
      "SELECT Id, Title FROM FAQ__kav WHERE PublishStatus = 'Online' LIMIT 1 UPDATE VIEWSTAT",
    );
  });

  it("combines both modes canonically after FOR VIEW or FOR REFERENCE", () => {
    const db = new Kysoql<FixtureSchema>();
    const viewed = db
      .selectFrom("FAQ__kav")
      .updateViewstat()
      .where("Language", "=", "en_US")
      .forView()
      .updateTracking()
      .select("Id");
    const referenced = db
      .selectFrom("FAQ__kav")
      .select("Id")
      .updateTracking()
      .forReference()
      .updateViewstat();

    expect(viewed.compile().soql).toBe(
      "SELECT Id FROM FAQ__kav WHERE Language = 'en_US' FOR VIEW UPDATE TRACKING, VIEWSTAT",
    );
    expect(referenced.compile().soql).toBe(
      "SELECT Id FROM FAQ__kav FOR REFERENCE UPDATE TRACKING, VIEWSTAT",
    );
  });

  it("accumulates modes immutably and ignores repeated modes", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("FAQ__kav")
      .select("Id");
    const tracking = base.updateTracking();
    const both = tracking.updateViewstat();
    const repeated = both.updateTracking();

    expect(base.toOperationNode().knowledgeUpdate).toBeUndefined();
    expect(tracking.toOperationNode().knowledgeUpdate).toEqual({
      kind: "KnowledgeUpdateNode",
      modes: ["tracking"],
    });
    expect(both.toOperationNode().knowledgeUpdate).toEqual({
      kind: "KnowledgeUpdateNode",
      modes: ["tracking", "viewstat"],
    });
    expect(repeated.toOperationNode().knowledgeUpdate).toEqual(
      both.toOperationNode().knowledgeUpdate,
    );
    expect(Object.isFrozen(both.toOperationNode().knowledgeUpdate)).toBe(true);
    expect(Object.isFrozen(both.toOperationNode().knowledgeUpdate?.modes)).toBe(
      true,
    );
  });

  it("allows the generic KnowledgeArticleVersion name and specific __kav article types", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(
      db
        .selectFrom("KnowledgeArticleVersion")
        .select("Id")
        .updateTracking()
        .compile().soql,
    ).toBe("SELECT Id FROM KnowledgeArticleVersion UPDATE TRACKING");
    expect(
      db
        .selectFrom("FAQ__kav")
        .select("Id")
        .updateViewstat()
        .compile().soql,
    ).toBe("SELECT Id FROM FAQ__kav UPDATE VIEWSTAT");
  });

  it("retains the top-level clause across aggregate and scalar COUNT builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("FAQ__kav")
      .select(({ fn }) => fn.count("Id").as("articleCount"))
      .updateTracking();
    const count = db
      .selectFrom("FAQ__kav")
      .select(({ fn }) => fn.count())
      .updateViewstat()
      .limit(10);

    expect(aggregate.compile().soql).toBe(
      "SELECT COUNT(Id) articleCount FROM FAQ__kav UPDATE TRACKING",
    );
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM FAQ__kav LIMIT 10 UPDATE VIEWSTAT",
    );
  });

  it("requires every possible table name to be a Knowledge article type", () => {
    const allowed: KnowledgeArticleUpdateCheck<
      "KnowledgeArticleVersion" | "FAQ__kav"
    > = [];

    void allowed;

    // @ts-expect-error A mixed Knowledge/non-Knowledge table union must stay rejected.
    const mixed: KnowledgeArticleUpdateCheck<"FAQ__kav" | "Account"> = [];
    void mixed;
  });

  it("rejects non-Knowledge objects at both the typed and compiler boundaries", () => {
    const db = new Kysoql<FixtureSchema>();

    void (() => {
      // @ts-expect-error UPDATE TRACKING is specific to Salesforce Knowledge article queries.
      db.selectFrom("Account").updateTracking();
      // @ts-expect-error UPDATE VIEWSTAT is specific to Salesforce Knowledge article queries.
      db.selectFrom("Account").updateViewstat();
      // @ts-expect-error Questions support data categories but not Knowledge article UPDATE clauses.
      db.selectFrom("Question").updateTracking();
    });

    const invalid = SelectQueryNode.cloneWithSelections(
      SelectQueryNode.cloneWithKnowledgeUpdateMode(
        SelectQueryNode.createFrom(SObjectNode.create("Account")),
        "tracking",
      ),
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(invalid)).toThrow(
      "UPDATE TRACKING and UPDATE VIEWSTAT can only be used with Salesforce Knowledge article queries.",
    );
  });

  it("keeps Knowledge update clauses out of relationship subqueries", () => {
    new Kysoql<FixtureSchema>()
      .selectFrom("Container__c")
      .select("Id")
      .selectSubquery("Articles", (articles) => {
        void (() => {
          // @ts-expect-error UPDATE TRACKING is a root SELECT clause.
          articles.updateTracking();
          // @ts-expect-error UPDATE VIEWSTAT is a root SELECT clause.
          articles.updateViewstat();
        });

        return articles.select("Id");
      });
  });
});
