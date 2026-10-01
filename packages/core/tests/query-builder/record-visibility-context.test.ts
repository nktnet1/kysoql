import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { RecordVisibilityContextNode } from "#/operation-node/record-visibility-context-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { DataCategorySelectionNode } from "#/operation-node/with-data-category-node";
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
  readonly Account: SalesforceObject<
    {
      readonly Id: Field<string, "id">;
      readonly Name: Field;
      readonly AnnualRevenue: Field<number, "currency">;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly Contact: SalesforceObject<{
    readonly Id: Field<string, "id">;
    readonly AccountId: SalesforceField<
      string,
      "reference",
      false,
      true,
      true,
      true,
      "Account"
    >;
  }>;
}

describe("WITH RecordVisibilityContext", () => {
  it("compiles documented parameters after WHERE in canonical order", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .orderBy("Name", "asc")
      .withRecordVisibilityContext({
        supportsDelegates: false,
        maxDescriptorPerRecord: 100,
        supportsDomains: true,
      })
      .where("Name", "=", "Acme")
      .limit(20);

    expect(query.compile().soql).toBe(
      "SELECT Id, Name FROM Account WHERE Name = 'Acme' WITH RecordVisibilityContext (maxDescriptorPerRecord=100, supportsDomains=true, supportsDelegates=false) ORDER BY Name ASC LIMIT 20",
    );
  });

  it("accepts any single documented parameter and replaces prior context immutably", () => {
    const base = new Kysoql<FixtureSchema>().selectFrom("Account").select("Id");
    const first = base.withRecordVisibilityContext({ supportsDomains: false });
    const second = first.withRecordVisibilityContext({
      maxDescriptorPerRecord: 25,
    });

    expect(base.toOperationNode().recordVisibilityContext).toBeUndefined();
    expect(first.toOperationNode().recordVisibilityContext).toEqual({
      kind: "RecordVisibilityContextNode",
      supportsDomains: false,
    });
    expect(second.toOperationNode().recordVisibilityContext).toEqual({
      kind: "RecordVisibilityContextNode",
      maxDescriptorPerRecord: 25,
    });
    expect(
      Object.isFrozen(first.toOperationNode().recordVisibilityContext),
    ).toBe(true);
    expect(first.compile().soql).toBe(
      "SELECT Id FROM Account WITH RecordVisibilityContext (supportsDomains=false)",
    );
    expect(second.compile().soql).toBe(
      "SELECT Id FROM Account WITH RecordVisibilityContext (maxDescriptorPerRecord=25)",
    );
  });

  it("retains the clause across aggregate and bare COUNT() builders", () => {
    const db = new Kysoql<FixtureSchema>();
    const aggregate = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count("Id").as("accountCount"))
      .withRecordVisibilityContext({ supportsDelegates: true })
      .groupBy("Name")
      .select("Name");
    const count = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .withRecordVisibilityContext({ maxDescriptorPerRecord: 50 })
      .limit(10);

    expect(aggregate.compile().soql).toBe(
      "SELECT COUNT(Id) accountCount, Name FROM Account WITH RecordVisibilityContext (supportsDelegates=true) GROUP BY Name",
    );
    expect(count.compile().soql).toBe(
      "SELECT COUNT() FROM Account WITH RecordVisibilityContext (maxDescriptorPerRecord=50) LIMIT 10",
    );
  });

  it("requires at least one parameter at type and runtime boundaries", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");

    function typecheckOnly(): void {
      // @ts-expect-error Salesforce requires at least one RecordVisibilityContext parameter.
      query.withRecordVisibilityContext({});
    }
    void typecheckOnly;

    expect(() => query.withRecordVisibilityContext({} as never)).toThrow(
      "SOQL WITH RecordVisibilityContext requires at least one parameter.",
    );
  });

  it("validates parameter names and values", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");

    expect(() =>
      query.withRecordVisibilityContext({ unknown: true } as never),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext supports only maxDescriptorPerRecord, supportsDomains, and supportsDelegates.",
    );
    expect(() =>
      query.withRecordVisibilityContext({ maxDescriptorPerRecord: -1 }),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext maxDescriptorPerRecord must be a non-negative safe integer.",
    );
    expect(() =>
      query.withRecordVisibilityContext({ maxDescriptorPerRecord: 1.5 }),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext maxDescriptorPerRecord must be a non-negative safe integer.",
    );
    expect(() =>
      query.withRecordVisibilityContext({ supportsDomains: "true" } as never),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext supportsDomains must be a boolean.",
    );
    expect(() =>
      query.withRecordVisibilityContext({ supportsDelegates: 1 } as never),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext supportsDelegates must be a boolean.",
    );
  });

  it("revalidates unsafe AST values at the compiler boundary", () => {
    const invalid = SelectQueryNode.cloneWithSelections(
      SelectQueryNode.cloneWithRecordVisibilityContext(
        SelectQueryNode.createFrom(SObjectNode.create("Account")),
        {
          kind: "RecordVisibilityContextNode",
          maxDescriptorPerRecord: -1,
        },
      ),
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() => new DefaultQueryCompiler().compileQuery(invalid)).toThrow(
      "SOQL WITH RecordVisibilityContext maxDescriptorPerRecord must be a non-negative safe integer.",
    );
  });

  it("rejects another WITH form on the same query", () => {
    const db = new Kysoql<FixtureSchema>();

    expect(() =>
      db
        .selectFrom("Account")
        .select("Id")
        .withRecordVisibilityContext({ supportsDomains: true })
        .apex()
        .withUserMode()
        .compile(),
    ).toThrow(
      "SOQL Apex access modes cannot be combined with another WITH filtering clause.",
    );

    const invalidDataCategory = SelectQueryNode.cloneWithSelections(
      SelectQueryNode.cloneWithDataCategorySelection(
        SelectQueryNode.cloneWithRecordVisibilityContext(
          SelectQueryNode.createFrom(SObjectNode.create("Account")),
          RecordVisibilityContextNode.create({ supportsDomains: true }),
        ),
        DataCategorySelectionNode.create("Geography__c", "at", ["All"]),
      ),
      [SelectionNode.create(ReferenceNode.create("Id"))],
    );

    expect(() =>
      new DefaultQueryCompiler().compileQuery(invalidDataCategory),
    ).toThrow(
      "SOQL WITH RecordVisibilityContext cannot be combined with another WITH clause.",
    );
  });

  it("keeps RecordVisibilityContext out of relationship subqueries", () => {
    new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) => {
        void (() => {
          // @ts-expect-error RecordVisibilityContext is a root SELECT clause.
          contacts.withRecordVisibilityContext({ supportsDomains: true });
        });

        return contacts.select("Id");
      });
  });
});
