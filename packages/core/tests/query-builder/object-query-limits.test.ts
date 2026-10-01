import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import { BinaryOperationNode } from "#src/operation-node/binary-operation-node";
import { OperatorNode } from "#src/operation-node/operator-node";
import { QueryNode } from "#src/operation-node/query-node";
import { ReferenceNode } from "#src/operation-node/reference-node";
import { SemiJoinSubqueryNode } from "#src/operation-node/semi-join-subquery-node";
import { SObjectNode } from "#src/operation-node/sobject-node";
import { ValueNode } from "#src/operation-node/value-node";
import { DefaultQueryCompiler } from "#src/query-compiler/default-query-compiler";
import type {
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#src/schema";
import { soqlDateTime } from "#src/soql-temporal-literal";

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

type ReferenceField<Target extends string> = SalesforceField<
  string,
  "reference",
  false,
  true,
  true,
  true,
  Target
>;

type MultiPicklistField = SalesforceField<
  string,
  "multipicklist",
  true,
  true,
  true,
  true,
  never,
  never,
  "Alpha" | "Beta"
>;

type PolymorphicReferenceField<
  Targets extends string,
  Relationship extends string,
> = SalesforceField<
  string,
  "reference",
  false,
  true,
  true,
  true,
  Targets,
  Relationship,
  never,
  true,
  false,
  true
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
  readonly UserRecordAccess: SalesforceObject<{
    readonly RecordId: ReferenceField<"Account">;
    readonly UserId: ReferenceField<"User">;
    readonly HasReadAccess: Field<boolean, "boolean">;
    readonly HasEditAccess: Field<boolean, "boolean">;
    readonly HasDeleteAccess: Field<boolean, "boolean">;
    readonly HasTransferAccess: Field<boolean, "boolean">;
    readonly HasAllAccess: Field<boolean, "boolean">;
    readonly MaxAccessLevel: Field<
      "None" | "Read" | "Edit" | "Delete" | "Transfer" | "All",
      "picklist"
    >;
  }>;
  readonly User: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
  readonly NewsFeed: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly ParentId: ReferenceField<"Account">;
      readonly CreatedDate: Field<string, "datetime">;
    },
    {
      readonly Parent: SalesforceParentRelationship<
        "Account",
        "ParentId",
        false
      >;
    }
  >;
  readonly UserProfileFeed: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly UserId: ReferenceField<"User">;
      readonly CreatedDate: Field<string, "datetime">;
    },
    {
      readonly User: SalesforceParentRelationship<"User", "UserId", false>;
    }
  >;
  readonly Config__mdt: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly DeveloperName: Field;
      readonly Priority__c: Field<number, "int">;
      readonly Status__c: Field<string, "picklist">;
      readonly Parent__c: ReferenceField<"ParentConfig__mdt">;
    },
    {
      readonly Parent__r: SalesforceParentRelationship<
        "ParentConfig__mdt",
        "Parent__c",
        false
      >;
    }
  >;
  readonly ParentConfig__mdt: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly DeveloperName: Field;
  }>;
  readonly Invoice__x: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Name: Field;
      readonly Amount__c: Field<number, "double">;
      readonly Status__c: Field<"Open" | "Closed", "picklist">;
      readonly Tags__c: MultiPicklistField;
      readonly WhatId: PolymorphicReferenceField<
        "Account" | "Opportunity",
        "What"
      >;
    },
    {
      readonly What: SalesforceParentRelationship<
        "Account" | "Opportunity",
        "WhatId",
        false
      >;
    }
  >;
  readonly Account: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
  readonly EventLog__b: SalesforceObject<{
    readonly Account__c: Field<string, "string">;
    readonly Kind__c: Field<string, "string">;
    readonly CreatedAt__c: Field<string, "datetime">;
    readonly Payload__c: Field<string, "string">;
  }>;
  readonly Opportunity: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name: Field;
  }>;
  readonly Profile__dlm: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Name__c: Field;
      readonly Score__c: Field<number, "double">;
      readonly Account__c: ReferenceField<"Account__dlm">;
    },
    {
      readonly Account__r: SalesforceParentRelationship<
        "Account__dlm",
        "Account__c",
        false
      >;
    }
  >;
  readonly Account__dlm: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly Name__c: Field;
    readonly Profile__c: ReferenceField<"Profile__dlm">;
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
    expect(() =>
      base.where("ContentDocumentId", "!=", "069000000000001").compile(),
    ).toThrow(
      "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.",
    );
    expect(() =>
      base.where("LinkedEntityId", "not in", ["001000000000001"]).compile(),
    ).toThrow(
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
      base.where("ContentHubRepositoryId", "=", "0XC000000000001").compile()
        .soql,
    ).toBe(
      "SELECT Id, Name FROM ContentHubItem WHERE ContentHubRepositoryId = '0XC000000000001'",
    );
  });

  it("requires the ContentDocumentLink ID predicate to be positive and conjunctive", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("ContentDocumentLink").select("Id");
    const error =
      "SOQL ContentDocumentLink queries require a WHERE predicate on Id, ContentDocumentId, or LinkedEntityId.";

    expect(() =>
      base
        .where((eb) => eb.not(eb("LinkedEntityId", "=", "001000000000001")))
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where((eb) =>
          eb.or([
            eb("LinkedEntityId", "=", "001000000000001"),
            eb("ShareType", "=", "V"),
          ]),
        )
        .compile(),
    ).toThrow(error);

    expect(
      base
        .where("LinkedEntityId", "=", "001000000000001")
        .where("ShareType", "=", "V")
        .compile().soql,
    ).toBe(
      "SELECT Id FROM ContentDocumentLink WHERE LinkedEntityId = '001000000000001' AND ShareType = 'V'",
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
    expect(() =>
      base
        .where((eb) => eb.not(eb("ParentId", "=", "0D5000000000001")))
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where((eb) =>
          eb.or([eb("Type", "=", "Up"), eb("Id", "=", "0D6000000000001")]),
        )
        .compile(),
    ).toThrow(error);

    expect(base.where("ParentId", "=", "0D5000000000001").compile().soql).toBe(
      "SELECT Id FROM Vote WHERE ParentId = '0D5000000000001'",
    );
    expect(base.where("Id", "=", "0D6000000000001").compile().soql).toBe(
      "SELECT Id FROM Vote WHERE Id = '0D6000000000001'",
    );
    expect(
      base.where("Id", "in", ["0D6000000000001", "0D6000000000002"]).compile()
        .soql,
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
    expect(count.where("Id", "in", ["0D6000000000001"]).compile().soql).toBe(
      "SELECT COUNT() FROM Vote WHERE Id IN ('0D6000000000001')",
    );
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

  it("requires UserRecordAccess to filter one user and one record or record list", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("UserRecordAccess").select("RecordId");
    const error =
      "SOQL UserRecordAccess queries require UserId = <single ID> and either RecordId = <single ID> or RecordId IN (<up to 200 IDs>), with at most one optional Has*Access = true predicate.";

    expect(() => base.compile()).toThrow(error);
    expect(() =>
      base.where("UserId", "=", "005000000000001").compile(),
    ).toThrow(error);
    expect(() =>
      base.where("RecordId", "=", "001000000000001").compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where("UserId", "in", ["005000000000001"])
        .where("RecordId", "=", "001000000000001")
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "!=", "001000000000001")
        .compile(),
    ).toThrow(error);

    expect(
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "=", "001000000000001")
        .compile().soql,
    ).toBe(
      "SELECT RecordId FROM UserRecordAccess WHERE UserId = '005000000000001' AND RecordId = '001000000000001'",
    );
    expect(
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "in", ["001000000000001", "001000000000002"])
        .compile().soql,
    ).toBe(
      "SELECT RecordId FROM UserRecordAccess WHERE UserId = '005000000000001' AND RecordId IN ('001000000000001', '001000000000002')",
    );
  });

  it("caps UserRecordAccess RecordId IN filters at 200 literal IDs", () => {
    const db = new Kysoql<FixtureSchema>();
    const recordIds = Array.from(
      { length: 200 },
      (_, index) => `001${String(index).padStart(12, "0")}`,
    );
    const base = db
      .selectFrom("UserRecordAccess")
      .select("RecordId")
      .where("UserId", "=", "005000000000001");

    expect(base.where("RecordId", "in", recordIds).compile().soql).toContain(
      "RecordId IN (",
    );

    expect(() =>
      base.where("RecordId", "in", [...recordIds, "001000000000200"]).compile(),
    ).toThrow(
      "SOQL UserRecordAccess queries require UserId = <single ID> and either RecordId = <single ID> or RecordId IN (<up to 200 IDs>), with at most one optional Has*Access = true predicate.",
    );
  });

  it("restricts UserRecordAccess filters to conjunctive documented predicates", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db.selectFrom("UserRecordAccess").select("RecordId");
    const error =
      "SOQL UserRecordAccess queries require UserId = <single ID> and either RecordId = <single ID> or RecordId IN (<up to 200 IDs>), with at most one optional Has*Access = true predicate.";

    expect(() =>
      base
        .where((eb) =>
          eb.or([
            eb("UserId", "=", "005000000000001"),
            eb("RecordId", "=", "001000000000001"),
          ]),
        )
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "=", "001000000000001")
        .where("MaxAccessLevel", "=", "Read")
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "=", "001000000000001")
        .where("HasReadAccess", "=", false)
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where("UserId", "=", "005000000000001")
        .where("RecordId", "=", "001000000000001")
        .where("HasReadAccess", "=", true)
        .where("HasEditAccess", "=", true)
        .compile(),
    ).toThrow(error);
  });

  it("requires UserRecordAccess access-filter queries to SELECT RecordId only", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL UserRecordAccess queries must SELECT RecordId and may select only Has*Access fields and MaxAccessLevel; queries filtered by Has*Access = true must SELECT RecordId only.";
    const filtered = db
      .selectFrom("UserRecordAccess")
      .where("UserId", "=", "005000000000001")
      .where("RecordId", "=", "001000000000001")
      .where("HasReadAccess", "=", true);

    expect(filtered.select("RecordId").compile().soql).toBe(
      "SELECT RecordId FROM UserRecordAccess WHERE UserId = '005000000000001' AND RecordId = '001000000000001' AND HasReadAccess = TRUE",
    );
    expect(() => filtered.select("HasReadAccess").compile()).toThrow(error);
    expect(() =>
      filtered.select(["RecordId", "HasReadAccess"]).compile(),
    ).toThrow(error);
  });

  it("restricts UserRecordAccess SELECT fields and couples access selections to ORDER BY", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db
      .selectFrom("UserRecordAccess")
      .where("UserId", "=", "005000000000001")
      .where("RecordId", "=", "001000000000001");
    const selectionError =
      "SOQL UserRecordAccess queries must SELECT RecordId and may select only Has*Access fields and MaxAccessLevel; queries filtered by Has*Access = true must SELECT RecordId only.";
    const orderError =
      "SOQL UserRecordAccess ORDER BY may reference only selected fields, and every selected Has*Access or MaxAccessLevel field must also be ordered.";

    expect(() => base.select("UserId").compile()).toThrow(selectionError);
    expect(() => base.select("HasReadAccess").compile()).toThrow(
      selectionError,
    );
    expect(() => base.select(["RecordId", "HasReadAccess"]).compile()).toThrow(
      orderError,
    );
    expect(() => base.select(["RecordId", "MaxAccessLevel"]).compile()).toThrow(
      orderError,
    );
    expect(() => base.select("RecordId").orderBy("UserId").compile()).toThrow(
      orderError,
    );

    expect(
      base
        .select(["RecordId", "HasReadAccess", "MaxAccessLevel"])
        .orderBy("HasReadAccess", "desc")
        .orderBy("MaxAccessLevel")
        .compile().soql,
    ).toBe(
      "SELECT RecordId, HasReadAccess, MaxAccessLevel FROM UserRecordAccess WHERE UserId = '005000000000001' AND RecordId = '001000000000001' ORDER BY HasReadAccess DESC, MaxAccessLevel",
    );
  });

  it("rejects aggregate and scalar COUNT UserRecordAccess query shapes", () => {
    const db = new Kysoql<FixtureSchema>();
    const selectionError =
      "SOQL UserRecordAccess queries must SELECT RecordId and may select only Has*Access fields and MaxAccessLevel; queries filtered by Has*Access = true must SELECT RecordId only.";
    const aggregate = db
      .selectFrom("UserRecordAccess")
      .select(({ fn }) => fn.count("HasReadAccess").as("accessCount"))
      .where("UserId", "=", "005000000000001")
      .where("RecordId", "=", "001000000000001");
    const count = db
      .selectFrom("UserRecordAccess")
      .select(({ fn }) => fn.count())
      .where("UserId", "=", "005000000000001")
      .where("RecordId", "=", "001000000000001");

    expect(() => aggregate.compile()).toThrow(selectionError);
    expect(() => count.compile()).toThrow(selectionError);
  });

  it("does not let UserRecordAccess RecordId semi-joins satisfy the literal-list form", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("UserRecordAccess")
      .select("RecordId")
      .where("UserId", "=", "005000000000001");
    const subquery = SemiJoinSubqueryNode.cloneWithSelection(
      SemiJoinSubqueryNode.createFrom(SObjectNode.create("Account")),
      ReferenceNode.create("Id"),
    );
    const queryNode = QueryNode.cloneWithWhere(
      base.toOperationNode(),
      BinaryOperationNode.create(
        ReferenceNode.create("RecordId"),
        OperatorNode.create("in"),
        subquery,
      ),
    );

    expect(() => new DefaultQueryCompiler().compileQuery(queryNode)).toThrow(
      "SOQL UserRecordAccess queries require UserId = <single ID> and either RecordId = <single ID> or RecordId IN (<up to 200 IDs>), with at most one optional Has*Access = true predicate.",
    );
  });

  it("rejects relationship-field ORDER BY on NewsFeed and UserProfileFeed", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL NewsFeed and UserProfileFeed ORDER BY clauses can reference only fields on the root object.";

    expect(
      db
        .selectFrom("NewsFeed")
        .select("Id")
        .orderBy("CreatedDate", "desc")
        .compile().soql,
    ).toBe("SELECT Id FROM NewsFeed ORDER BY CreatedDate DESC");
    expect(() =>
      db.selectFrom("NewsFeed").select("Id").orderBy("Parent.Name").compile(),
    ).toThrow(error);

    expect(
      db
        .selectFrom("UserProfileFeed")
        .select("Id")
        .withUserId("005000000000001")
        .orderBy("CreatedDate")
        .compile().soql,
    ).toBe(
      "SELECT Id FROM UserProfileFeed WITH UserId = '005000000000001' ORDER BY CreatedDate",
    );
    expect(() =>
      db
        .selectFrom("UserProfileFeed")
        .select("Id")
        .withUserId("005000000000001")
        .orderBy("User.Name")
        .compile(),
    ).toThrow(error);
  });

  it("enforces custom metadata WHERE operator and OR restrictions", () => {
    const db = new Kysoql<FixtureSchema>();
    const base = db
      .selectFrom("Config__mdt")
      .select(["Id", "DeveloperName", "Parent__r.DeveloperName"]);
    const error =
      "SOQL custom metadata type WHERE clauses support IN/NOT IN, =, !=, >, >=, <, <=, LIKE, AND, and same-field OR groups using only =/LIKE predicates.";

    expect(
      base
        .where("Parent__r.DeveloperName", "=", "Parent")
        .where("Priority__c", ">=", 10)
        .where((eb) =>
          eb.or([
            eb("DeveloperName", "=", "Primary"),
            eb("DeveloperName", "like", "Fallback%"),
          ]),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id, DeveloperName, Parent__r.DeveloperName FROM Config__mdt WHERE Parent__r.DeveloperName = 'Parent' AND Priority__c >= 10 AND (DeveloperName = 'Primary' OR DeveloperName LIKE 'Fallback%')",
    );
    expect(
      db
        .selectFrom("Config__mdt")
        .select("Id")
        .where("DeveloperName", "in", ["Primary", "Secondary"])
        .where("Parent__r.DeveloperName", "not in", ["Hidden"])
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Config__mdt WHERE DeveloperName IN ('Primary', 'Secondary') AND Parent__r.DeveloperName NOT IN ('Hidden')",
    );
    expect(
      db
        .selectFrom("Config__mdt")
        .select("Id")
        .where((eb) =>
          eb.or([
            eb(eb.fn.toLabel("Status__c"), "=", "Translated Active"),
            eb(eb.fn.toLabel("Status__c"), "like", "Translated%"),
          ]),
        )
        .compile().soql,
    ).toBe(
      "SELECT Id FROM Config__mdt WHERE (toLabel(Status__c) = 'Translated Active' OR toLabel(Status__c) LIKE 'Translated%')",
    );

    expect(() =>
      base
        .where((eb) =>
          eb.or([
            eb("DeveloperName", "=", "Primary"),
            eb("Priority__c", "=", 10),
          ]),
        )
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .where((eb) =>
          eb.or([eb("Priority__c", ">", 10), eb("Priority__c", "=", 20)]),
        )
        .compile(),
    ).toThrow(error);
    expect(() =>
      base.where((eb) => eb.not(eb("DeveloperName", "=", "Hidden"))).compile(),
    ).toThrow(error);
  });

  it("rejects unsupported custom metadata operators at the compiler boundary", () => {
    const base = new Kysoql<FixtureSchema>()
      .selectFrom("Config__mdt")
      .select("Id");
    const queryNode = QueryNode.cloneWithWhere(
      base.toOperationNode(),
      BinaryOperationNode.create(
        ReferenceNode.create("DeveloperName"),
        OperatorNode.create("includes"),
        ValueNode.create("Primary"),
      ),
    );

    expect(() => new DefaultQueryCompiler().compileQuery(queryNode)).toThrow(
      "SOQL custom metadata type WHERE clauses support IN/NOT IN, =, !=, >, >=, <, <=, LIKE, AND, and same-field OR groups using only =/LIKE predicates.",
    );
  });

  it("rejects relationship-field ORDER BY on custom metadata types", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL custom metadata type ORDER BY clauses can reference only non-relationship fields.";

    expect(
      db
        .selectFrom("Config__mdt")
        .select("Id")
        .orderBy("DeveloperName")
        .compile().soql,
    ).toBe("SELECT Id FROM Config__mdt ORDER BY DeveloperName");
    expect(() =>
      db
        .selectFrom("Config__mdt")
        .select("Id")
        .orderBy("Parent__r.DeveloperName")
        .compile(),
    ).toThrow(error);
  });

  it("allows the external-object subset Salesforce documents as supported", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(
      db
        .selectFrom("Invoice__x")
        .select(["Id", "Name"])
        .where("Status__c", "=", "Open")
        .orderBy("Name")
        .limit(25)
        .compile().soql,
    ).toBe(
      "SELECT Id, Name FROM Invoice__x WHERE Status__c = 'Open' ORDER BY Name LIMIT 25",
    );
    expect(
      db
        .selectFrom("Invoice__x")
        .select(({ fn }) => fn.count())
        .compile().soql,
    ).toBe("SELECT COUNT() FROM Invoice__x");
  });

  it("rejects unsupported external-object filters and query clauses", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL external objects do not support GROUP BY, HAVING, fielded COUNT/AVG/MIN/MAX/SUM, LIKE, INCLUDES/EXCLUDES, toLabel(), TYPEOF, FOR VIEW/REFERENCE, or WITH clauses.";
    const base = db.selectFrom("Invoice__x");

    expect(() =>
      base.select("Id").where("Name", "like", "A%").compile(),
    ).toThrow(error);
    expect(() =>
      base.select("Id").where("Tags__c", "includes", ["Alpha"]).compile(),
    ).toThrow(error);
    expect(() =>
      base.select(({ fn }) => fn.count("Id").as("invoiceCount")).compile(),
    ).toThrow(error);
    expect(() =>
      base.select(({ fn }) => fn.sum("Amount__c").as("total")).compile(),
    ).toThrow(error);
    expect(() =>
      base
        .select(({ fn }) => fn.toLabel("Status__c").as("statusLabel"))
        .compile(),
    ).toThrow(error);
    expect(() =>
      base
        .select("Id")
        .where((eb) => eb(eb.fn.toLabel("Status__c"), "=", "Open"))
        .compile(),
    ).toThrow(error);
    expect(() => base.select("Id").forView().compile()).toThrow(error);
  });

  it("rejects GROUP BY, HAVING, and TYPEOF on external objects", () => {
    const db = new Kysoql<FixtureSchema>();
    const error =
      "SOQL external objects do not support GROUP BY, HAVING, fielded COUNT/AVG/MIN/MAX/SUM, LIKE, INCLUDES/EXCLUDES, toLabel(), TYPEOF, FOR VIEW/REFERENCE, or WITH clauses.";

    expect(() =>
      db
        .selectFrom("Invoice__x")
        .select(({ fn }) => fn.countDistinct("Status__c").as("statuses"))
        .groupBy("Status__c")
        .having((eb) => eb(eb.fn.countDistinct("Status__c"), ">", 0))
        .compile(),
    ).toThrow(error);

    expect(() =>
      db
        .selectFrom("Invoice__x")
        .select("Id")
        .selectTypeOf("What", (typeOf) =>
          typeOf.when("Account", ["Name"]).when("Opportunity", ["Name"]),
        )
        .compile(),
    ).toThrow(error);
  });

  it("validates big-object index prefixes and final-field operators", () => {
    const db = new Kysoql<FixtureSchema>({
      schemaMetadata: {
        bigObjectIndexes: {
          EventLog__b: ["Account__c", "Kind__c", "CreatedAt__c"],
        },
      },
    });
    const base = db.selectFrom("EventLog__b").select("Payload__c");
    const error =
      "SOQL big object WHERE clauses must use a leading, gap-free prefix of the configured index; preceding index fields require =, and the final field supports only =, <, >, <=, >=, or IN.";

    expect(base.where("Account__c", "=", "001").compile().soql).toBe(
      "SELECT Payload__c FROM EventLog__b WHERE Account__c = '001'",
    );
    expect(
      base
        .where("Account__c", "=", "001")
        .where("Kind__c", "=", "audit")
        .where("CreatedAt__c", ">=", soqlDateTime("2026-01-01T00:00:00Z"))
        .where("CreatedAt__c", "<", soqlDateTime("2027-01-01T00:00:00Z"))
        .compile().soql,
    ).toContain(
      "CreatedAt__c >= 2026-01-01T00:00:00Z AND CreatedAt__c < 2027-01-01T00:00:00Z",
    );

    expect(base.compile().soql).toBe("SELECT Payload__c FROM EventLog__b");
    expect(() => base.where("Kind__c", "=", "audit").compile()).toThrow(error);
    expect(() =>
      base
        .where("Account__c", ">", "001")
        .where("Kind__c", "=", "audit")
        .compile(),
    ).toThrow(error);
    expect(() => base.where("Account__c", "!=", "001").compile()).toThrow(
      error,
    );
    expect(() => base.where("Payload__c", "=", "payload").compile()).toThrow(
      error,
    );
  });

  it("validates Data 360 query restrictions", () => {
    const db = new Kysoql<FixtureSchema>({
      schemaMetadata: {
        data360StringFields: {
          Profile__dlm: ["Name__c"],
          Account__dlm: ["Name__c"],
        },
        data360LookupFields: {
          Profile__dlm: ["Account__c"],
          Account__dlm: ["Profile__c"],
        },
      },
    });
    const profile = db.selectFrom("Profile__dlm");

    expect(() =>
      profile
        .select(({ fn }) => fn.count("Id").as("count"))
        .groupBy("Id")
        .compile(),
    ).toThrow("SOQL Data 360 queries cannot GROUP BY Id.");

    expect(() =>
      profile
        .select(({ fn }) => fn.count("Id").as("count"))
        .groupBy("Name__c")
        .having((eb) => eb(eb.fn.count("Id"), ">", 1))
        .compile(),
    ).toThrow(
      "SOQL Data 360 HAVING clauses cannot reference Id or COUNT(Id), use IN, or compare with null.",
    );

    expect(() =>
      profile
        .groupBy("Name__c")
        .select("Name__c")
        .having("Name__c", "in", ["A", "B"])
        .compile(),
    ).toThrow(
      "SOQL Data 360 HAVING clauses cannot reference Id or COUNT(Id), use IN, or compare with null.",
    );

    expect(() =>
      profile
        .groupBy("Name__c")
        .select("Name__c")
        .having("Name__c", "!=", null as never)
        .compile(),
    ).toThrow(
      "SOQL Data 360 HAVING clauses cannot reference Id or COUNT(Id), use IN, or compare with null.",
    );

    expect(() =>
      profile.select("Id").where("Name__c", ">", "M").compile(),
    ).toThrow(
      "SOQL Data 360 queries do not support >, <, >=, or <= comparisons on string fields.",
    );
    expect(
      profile.select("Id").where("Score__c", ">", 10).compile().soql,
    ).toContain("Score__c > 10");

    expect(() => profile.select("Account__r.Id").compile()).toThrow(
      "SOQL Data 360 queries do not support child-to-parent relationships.",
    );

    expect(
      profile
        .select("Id")
        .where("Account__c", "in", (subquery) =>
          subquery.selectFrom("Account__dlm").select("Profile__c" as never),
        )
        .compile().soql,
    ).toContain("Account__c IN (SELECT Profile__c FROM Account__dlm)");

    expect(() =>
      profile
        .select("Id")
        .where("Id", "in", (subquery) =>
          subquery.selectFrom("Account__dlm").select("Id" as never),
        )
        .compile(),
    ).toThrow(
      "SOQL semi-joins between Data 360 DMOs must use lookup fields on both sides.",
    );
  });

  it("does not impose the specialist limits on ordinary objects", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"]);

    expect(query.compile().soql).toBe("SELECT Id, Name FROM Account");
  });
});
