import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import { OperatorNode } from "#/operation-node/operator-node";
import { QueryNode } from "#/operation-node/query-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SemiJoinSubqueryNode } from "#/operation-node/semi-join-subquery-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { ValueNode } from "#/operation-node/value-node";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type { SalesforceField, SalesforceObject } from "#/schema";

type Field<
  Value = string,
  Type extends string = "string",
> = SalesforceField<Value, Type, false, true, true, true, never, never, never, true>;

type ReferenceField<Target extends string> = SalesforceField<
  string,
  "reference",
  false,
  true,
  true,
  true,
  Target
>;

interface FixtureSchema {
  readonly ContentDocumentLink: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly ContentDocumentId: ReferenceField<"ContentDocument">;
    readonly LinkedEntityId: ReferenceField<"Account">;
    readonly ShareType: Field;
  }>;
  readonly ContentHubItem: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly ExternalId: Field;
    readonly ContentHubRepositoryId: ReferenceField<"ContentHubRepository">;
    readonly Name: Field;
  }>;
  readonly Vote: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly ParentId: ReferenceField<"FeedItem">;
    readonly Type: Field;
  }>;
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
}

describe("object-specific SOQL query limits", () => {
  it("requires ContentDocumentLink to filter on a supported root field", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("ContentDocumentLink").select("Id");

    expect(() => base.compile()).toThrow(
      "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.",
    );
    expect(() => base.where("ShareType", "=", "V").compile()).toThrow(
      "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.",
    );

    expect(base.where("Id", "=", "06A000000000001").compile().soql).toBe(
      "SELECT Id FROM ContentDocumentLink WHERE Id = '06A000000000001'",
    );
    expect(
      base
        .where("ContentDocumentId", "in", [
          "069000000000001",
          "069000000000002",
        ])
        .compile().soql,
    ).toBe(
      "SELECT Id FROM ContentDocumentLink WHERE ContentDocumentId IN ('069000000000001', '069000000000002')",
    );
    expect(
      base.where("LinkedEntityId", "=", "001000000000001").compile().soql,
    ).toBe(
      "SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = '001000000000001'",
    );
  });

  it("requires ContentHubItem to filter on a supported root field", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("ContentHubItem").select(["Id", "Name"]);

    expect(() => base.compile()).toThrow(
      "SOQL ContentHubItem queries require a WHERE predicate on Id, ExternalId, or ContentHubRepositoryId.",
    );
    expect(() => base.where("Name", "=", "Example").compile()).toThrow(
      "SOQL ContentHubItem queries require a WHERE predicate on Id, ExternalId, or ContentHubRepositoryId.",
    );

    expect(base.where("ExternalId", "=", "external-1").compile().soql).toBe(
      "SELECT Id, Name FROM ContentHubItem WHERE ExternalId = 'external-1'",
    );
    expect(
      base
        .where("ContentHubRepositoryId", "=", "0XC000000000001")
        .compile().soql,
    ).toBe(
      "SELECT Id, Name FROM ContentHubItem WHERE ContentHubRepositoryId = '0XC000000000001'",
    );
  });

  it("finds required predicates inside nested boolean expressions", () => {
    const db = new Kysoql<FixtureSchema>();
    const query = db
      .selectFrom("ContentDocumentLink")
      .select("Id")
      .where((eb) =>
        eb.and([
          eb("ShareType", "=", "V"),
          eb.not(
            eb.or([
              eb("LinkedEntityId", "=", "001000000000001"),
              eb("ShareType", "=", "C"),
            ]),
          ),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id FROM ContentDocumentLink WHERE ShareType = 'V' AND NOT (LinkedEntityId = '001000000000001' OR ShareType = 'C')",
    );
  });

  it("enforces the limits across aggregate and scalar COUNT builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("ContentHubItem")
      .select(({ fn }) => fn.count("Id").as("itemCount"));
    const count = db
      .selectFrom("ContentDocumentLink")
      .select(({ fn }) => fn.count());

    expect(() => aggregate.compile()).toThrow(
      "SOQL ContentHubItem queries require a WHERE predicate on Id, ExternalId, or ContentHubRepositoryId.",
    );
    expect(() => count.compile()).toThrow(
      "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.",
    );

    expect(
      aggregate.where("ExternalId", "=", "external-1").compile().soql,
    ).toBe(
      "SELECT COUNT(Id) itemCount FROM ContentHubItem WHERE ExternalId = 'external-1'",
    );
    expect(count.where("Id", "=", "06A000000000001").compile().soql).toBe(
      "SELECT COUNT() FROM ContentDocumentLink WHERE Id = '06A000000000001'",
    );
  });

  it("requires Vote to use one of Salesforce's supported filter shapes", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("Vote").select("Id");
    const error =
      "SOQL Vote queries require a WHERE predicate using ParentId = <single ID>, Parent.Type = <single type>, Id = <single ID>, or Id IN (<ID list>).";

    expect(() => base.compile()).toThrow(error);
    expect(() => base.where("Type", "=", "Up").compile()).toThrow(error);
    expect(() =>
      base.where("ParentId", "in", ["0D5000000000001"]).compile(),
    ).toThrow(error);
    expect(() => base.where("Id", "!=", "0D6000000000001").compile()).toThrow(
      error,
    );

    expect(base.where("ParentId", "=", "0D5000000000001").compile().soql).toBe(
      "SELECT Id FROM Vote WHERE ParentId = '0D5000000000001'",
    );
    expect(base.where("Id", "=", "0D6000000000001").compile().soql).toBe(
      "SELECT Id FROM Vote WHERE Id = '0D6000000000001'",
    );
    expect(
      base
        .where("Id", "in", ["0D6000000000001", "0D6000000000002"])
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Vote WHERE Id IN ('0D6000000000001', '0D6000000000002')",
    );
  });

  it("enforces Vote restrictions across aggregate and scalar COUNT builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL Vote queries require a WHERE predicate using ParentId = <single ID>, Parent.Type = <single type>, Id = <single ID>, or Id IN (<ID list>).";
    const aggregate = db
      .selectFrom("Vote")
      .select(({ fn }) => fn.count("Id").as("voteCount"));
    const count = db.selectFrom("Vote").select(({ fn }) => fn.count());

    expect(() => aggregate.compile()).toThrow(error);
    expect(() => count.compile()).toThrow(error);
    expect(
      aggregate.where("ParentId", "=", "0D5000000000001").compile().soql,
    ).toBe(
      "SELECT COUNT(Id) voteCount FROM Vote WHERE ParentId = '0D5000000000001'",
    );
    expect(
      count.where("Id", "in", ["0D6000000000001"]).compile().soql,
    ).toBe("SELECT COUNT() FROM Vote WHERE Id IN ('0D6000000000001')");
  });

  it("accepts the Vote Parent.Type relationship filter shape", () => {
    const base = new Kysoql<FixtureSchema>().selectFrom("Vote").select("Id");
    const parentTypeQuery = QueryNode.cloneWithWhere(
      base.toOperationNode(),
      BinaryOperationNode.create(
        ReferenceNode.create("Parent.Type"),
        OperatorNode.create("="),
        ValueNode.create("FeedItem"),
      ),
    );

    expect(new DefaultQueryCompiler().compileQuery(parentTypeQuery).soql).toBe(
      "SELECT Id FROM Vote WHERE Parent.Type = 'FeedItem'",
    );
  });

  it("does not let Vote semi-joins satisfy the required Id IN literal-list form", () => {
    const base = new Kysoql<FixtureSchema>().selectFrom("Vote").select("Id");
    const subquery = SemiJoinSubqueryNode.cloneWithSelection(
      SemiJoinSubqueryNode.createFrom(SObjectNode.create("Account")),
      ReferenceNode.create("Id"),
    );
    const queryNode = QueryNode.cloneWithWhere(
      base.toOperationNode(),
      BinaryOperationNode.create(
        ReferenceNode.create("Id"),
        OperatorNode.create("in"),
        subquery,
      ),
    );

    expect(() => new DefaultQueryCompiler().compileQuery(queryNode)).toThrow(
      "SOQL Vote queries require a WHERE predicate using ParentId = <single ID>, Parent.Type = <single type>, Id = <single ID>, or Id IN (<ID list>).",
    );
  });

  it("does not impose the specialist limits on ordinary objects", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);

    expect(query.compile().soql).toBe("SELECT Id, Name FROM Account");
  });
});
