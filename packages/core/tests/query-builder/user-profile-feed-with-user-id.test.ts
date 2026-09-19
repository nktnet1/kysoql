import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { UserProfileFeedWithNode } from "#/operation-node/user-profile-feed-with-node";
import { DataCategorySelectionNode } from "#/operation-node/with-data-category-node";
import type { UserProfileFeedWithUserIdCheck } from "#/parser/user-profile-feed-parser";
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

interface FixtureSchema {
  readonly UserProfileFeed: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly UserId: SalesforceField<
      string,
      "reference",
      false,
      true,
      true,
      true,
      "User"
    >;
    readonly CreatedDate: Field<string, "datetime">;
    readonly Body: Field;
  }>;
  readonly Account: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
    },
    Record<string, never>,
    {
      readonly FeedItems: SalesforceChildRelationship<
        "UserProfileFeed",
        "ParentId"
      >;
    }
  >;
}

describe("UserProfileFeed WITH UserId", () => {
  it("compiles the required clause after WHERE and before ORDER BY", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("UserProfileFeed")
      .orderBy("CreatedDate", "desc")
      .withUserId("005D0000001AamR")
      .where("Body", "like", "release%")
      .select(["Id", "CreatedDate"])
      .limit(20);

    expect(query.compile().soql).toBe(
      "SELECT Id, CreatedDate FROM UserProfileFeed WHERE Body LIKE 'release%' WITH UserId = '005D0000001AamR' ORDER BY CreatedDate DESC LIMIT 20",
    );
  });

  it("replaces the previous UserId immutably", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("UserProfileFeed")
      .select("Id");
    const first = base.withUserId("005D0000001AamR");
    const second = first.withUserId("005D0000001AamS");

    expect(base.toOperationNode().userProfileFeedWith).toBeUndefined();
    expect(first.toOperationNode().userProfileFeedWith).toEqual({
      kind: "UserProfileFeedWithNode",
      userId: {
        kind: "ValueNode",
        value: "005D0000001AamR",
      },
    });
    expect(second.toOperationNode().userProfileFeedWith).toEqual({
      kind: "UserProfileFeedWithNode",
      userId: {
        kind: "ValueNode",
        value: "005D0000001AamS",
      },
    });
    expect(first.compile().soql).toBe(
      "SELECT Id FROM UserProfileFeed WITH UserId = '005D0000001AamR'",
    );
    expect(second.compile().soql).toBe(
      "SELECT Id FROM UserProfileFeed WITH UserId = '005D0000001AamS'",
    );
  });

  it("accepts scalar User ID strings and rejects empty values", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(
      db
        .selectFrom("UserProfileFeed")
        .select("Id")
        .withUserId("005D0000001AamRABC")
        .compile().soql,
    ).toBe("SELECT Id FROM UserProfileFeed WITH UserId = '005D0000001AamRABC'");

    expect(() => db.selectFrom("UserProfileFeed").withUserId("")).toThrow(
      "SOQL UserProfileFeed WITH UserId requires a non-empty User ID string.",
    );
  });

  it("requires WITH UserId on every UserProfileFeed query", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(() =>
      db.selectFrom("UserProfileFeed").select("Id").compile(),
    ).toThrow("SOQL UserProfileFeed queries require WITH UserId = <userId>.");
  });

  it("retains the clause across aggregate and scalar COUNT builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("UserProfileFeed")
      .select(({ fn }) => fn.count("Id").as("feedItemCount"))
      .withUserId("005D0000001AamR");
    const count = db
      .selectFrom("UserProfileFeed")
      .select(({ fn }) => fn.count())
      .withUserId("005D0000001AamR")
      .limit(10);

    expect(aggregate.compile().soql).toBe(
      "SELECT COUNT(Id) feedItemCount FROM UserProfileFeed WITH UserId = '005D0000001AamR'",
    );
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM UserProfileFeed WITH UserId = '005D0000001AamR' LIMIT 10",
    );
  });

  it("requires every possible table name to be UserProfileFeed", () => {
    const allowed: UserProfileFeedWithUserIdCheck<"UserProfileFeed"> = [];
    void allowed;

    // @ts-expect-error A mixed UserProfileFeed/non-feed table union must stay rejected.
    const mixed: UserProfileFeedWithUserIdCheck<"UserProfileFeed" | "Account"> =
      [];
    void mixed;
  });

  it("rejects WITH UserId on other objects at typed and compiler boundaries", () => {
    const db = new Kysoql<FixtureSchema>();

    void (() => {
      // @ts-expect-error WITH UserId is specific to UserProfileFeed queries.
      db.selectFrom("Account").withUserId("005D0000001AamR");
    });

    const invalid = SelectQueryNode.cloneWithSelections(
      SelectQueryNode.cloneWithUserProfileFeedWith(
        SelectQueryNode.createFrom(SObjectNode.create("Account")),
        UserProfileFeedWithNode.create("005D0000001AamR"),
      ),
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(invalid)).toThrow(
      "SOQL WITH UserId can only be used with UserProfileFeed queries.",
    );
  });

  it("rejects combining the object-specific WITH clause with WITH DATA CATEGORY", () => {
    const invalid = SelectQueryNode.cloneWithSelections(
      SelectQueryNode.cloneWithDataCategorySelection(
        SelectQueryNode.cloneWithUserProfileFeedWith(
          SelectQueryNode.createFrom(SObjectNode.create("UserProfileFeed")),
          UserProfileFeedWithNode.create("005D0000001AamR"),
        ),
        DataCategorySelectionNode.create("Geography__c", "at", ["All"]),
      ),
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(invalid)).toThrow(
      "SOQL WITH UserId cannot be combined with WITH DATA CATEGORY.",
    );
  });

  it("revalidates unsafe UserId AST values at the compiler boundary", () => {
    const invalidWith = {
      kind: "UserProfileFeedWithNode",
      userId: {
        kind: "ValueNode",
        value: 123,
      },
    } as const;
    const invalid = SelectQueryNode.cloneWithSelections(
      {
        ...SelectQueryNode.createFrom(SObjectNode.create("UserProfileFeed")),
        userProfileFeedWith: invalidWith,
      },
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(invalid)).toThrow(
      "SOQL UserProfileFeed WITH UserId requires a non-empty User ID string.",
    );
  });

  it("keeps WITH UserId out of relationship subqueries", () => {
    new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("FeedItems", (feedItems) => {
        void (() => {
          // @ts-expect-error WITH UserId is a root UserProfileFeed SELECT clause.
          feedItems.withUserId("005D0000001AamR");
        });

        return feedItems.select("Id");
      });
  });
});
