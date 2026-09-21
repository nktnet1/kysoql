import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type { SelectQueryBuilder } from "#/query-builder/select-query-builder";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
  SalesforceQueryResult,
} from "#/schema";
import type { Simplify } from "#/util/type-utils";

type CustomField<
  Value,
  SalesforceType extends string,
  Nullable extends boolean,
  Filterable extends boolean,
  Sortable extends boolean,
  Groupable extends boolean,
  ReferenceTo extends string = never,
  RelationshipName extends string = never,
  ActivePicklistValue extends string = never,
  Aggregatable extends boolean = false,
> = SalesforceField<
  Value,
  SalesforceType,
  Nullable,
  Filterable,
  Sortable,
  Groupable,
  ReferenceTo,
  RelationshipName,
  ActivePicklistValue,
  Aggregatable,
  true
>;

interface RelationshipSubquerySchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Name: SalesforceField<string, "string", true, true, true, true>;
    },
    Record<string, never>,
    {
      readonly Contacts: SalesforceChildRelationship<"Contact", "AccountId">;
    }
  >;
  readonly Contact: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly LastName: SalesforceField<
        string,
        "string",
        false,
        true,
        true,
        true
      >;
      readonly LifetimeValue__c: CustomField<
        number,
        "currency",
        true,
        true,
        true,
        true
      >;
      readonly Salutation: SalesforceField<
        string,
        "picklist",
        true,
        true,
        true,
        true,
        never,
        never,
        "Mr." | "Ms."
      >;
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
      readonly CreatedById: SalesforceField<
        string,
        "reference",
        false,
        true,
        true,
        true,
        "User",
        "CreatedBy"
      >;
      readonly Internal_Note__c: CustomField<
        string,
        "string",
        true,
        false,
        false,
        false
      >;
    },
    {
      readonly Account: SalesforceParentRelationship<
        "Account",
        "AccountId",
        true
      >;
      readonly CreatedBy: SalesforceParentRelationship<
        "User",
        "CreatedById",
        false
      >;
    },
    {
      readonly Cases: SalesforceChildRelationship<"Case", "ContactId">;
    }
  >;
  readonly User: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Alias: SalesforceField<string, "string", true, true, true, true>;
    readonly Quota__c: CustomField<number, "currency", false, true, true, true>;
  }>;
  readonly Case: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly ContactId: SalesforceField<
        string,
        "reference",
        true,
        true,
        true,
        true,
        "Contact",
        "Contact"
      >;
      readonly Subject: SalesforceField<
        string,
        "string",
        true,
        true,
        true,
        true
      >;
    },
    {
      readonly Contact: SalesforceParentRelationship<
        "Contact",
        "ContactId",
        true
      >;
    },
    {
      readonly Comments: SalesforceChildRelationship<"CaseComment", "ParentId">;
    }
  >;
  readonly CaseComment: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly ParentId: SalesforceField<
        string,
        "reference",
        false,
        true,
        true,
        true,
        "Case",
        "Parent"
      >;
      readonly CommentBody: SalesforceField<
        string,
        "textarea",
        false,
        false,
        false,
        false
      >;
    },
    {
      readonly Parent: SalesforceParentRelationship<"Case", "ParentId", false>;
    },
    {
      readonly Attachments: SalesforceChildRelationship<
        "Attachment",
        "ParentId"
      >;
    }
  >;
  readonly Attachment: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly ParentId: SalesforceField<
        string,
        "reference",
        false,
        true,
        true,
        true,
        "CaseComment",
        "Parent"
      >;
      readonly Name: SalesforceField<string, "string", false, true, true, true>;
    },
    {
      readonly Parent: SalesforceParentRelationship<
        "CaseComment",
        "ParentId",
        false
      >;
    },
    {
      readonly Tags: SalesforceChildRelationship<
        "AttachmentTag",
        "AttachmentId"
      >;
    }
  >;
  readonly AttachmentTag: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly AttachmentId: SalesforceField<
      string,
      "reference",
      false,
      true,
      true,
      true,
      "Attachment",
      "Attachment"
    >;
  }>;
}

interface RepeatedChildRelationshipSchema {
  readonly LegalEntity: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
    },
    Record<string, never>,
    {
      readonly FinanceBalanceSnapshots:
        | SalesforceChildRelationship<"FinanceBalanceSnapshot", "LegalEntityId">
        | SalesforceChildRelationship<
            "FinanceBalanceSnapshot",
            "ReferenceEntityId"
          >;
    }
  >;
  readonly FinanceBalanceSnapshot: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly LegalEntityId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "LegalEntity",
      "LegalEntity"
    >;
    readonly ReferenceEntityId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "LegalEntity",
      "LegalEntity"
    >;
  }>;
}

type OutputOf<Query> =
  Query extends SelectQueryBuilder<infer _DB, infer _TB, infer Output>
    ? Output
    : never;

describe("parent-to-child relationship subqueries", () => {
  it("builds an immutable typed child relationship subquery", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select(["Id", "Name"])
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName", "CreatedBy.Alias"])
          .select(({ fn }) => fn.toLabel("Salutation").as("salutationLabel"))
          .where("LastName", "like", "A%")
          .where((eb) => eb("CreatedBy.Alias", "=", "x"))
          .orderBy("LastName", "asc", "last")
          .limit(20)
          .limit(5),
      );

    expect(query.toOperationNode().selections?.[2]).toEqual({
      kind: "SelectionNode",
      selection: {
        kind: "RelationshipSubqueryNode",
        relationship: { kind: "ReferenceNode", name: "Contacts" },
        selections: [
          {
            kind: "SelectionNode",
            selection: { kind: "ReferenceNode", name: "Id" },
          },
          {
            kind: "SelectionNode",
            selection: { kind: "ReferenceNode", name: "LastName" },
          },
          {
            kind: "SelectionNode",
            selection: { kind: "ReferenceNode", name: "CreatedBy.Alias" },
          },
          {
            kind: "SelectionNode",
            selection: {
              kind: "AliasNode",
              alias: "salutationLabel",
              node: {
                kind: "ToLabelFunctionNode",
                reference: {
                  kind: "ReferenceNode",
                  name: "Salutation",
                },
              },
            },
          },
        ],
        where: {
          kind: "WhereNode",
          where: {
            kind: "AndNode",
            left: {
              kind: "BinaryOperationNode",
              leftOperand: { kind: "ReferenceNode", name: "LastName" },
              operator: { kind: "OperatorNode", operator: "like" },
              rightOperand: { kind: "ValueNode", value: "A%" },
            },
            right: {
              kind: "BinaryOperationNode",
              leftOperand: {
                kind: "ReferenceNode",
                name: "CreatedBy.Alias",
              },
              operator: { kind: "OperatorNode", operator: "=" },
              rightOperand: { kind: "ValueNode", value: "x" },
            },
          },
        },
        orderBy: {
          kind: "OrderByNode",
          items: [
            {
              kind: "OrderByItemNode",
              orderBy: { kind: "ReferenceNode", name: "LastName" },
              direction: "asc",
              nulls: "last",
            },
          ],
        },
        limit: { kind: "LimitNode", limit: 5 },
      },
    });

    expect(Object.isFrozen(query.toOperationNode().selections?.[2])).toBe(true);
    expect(
      Object.isFrozen(query.toOperationNode().selections?.[2]?.selection),
    ).toBe(true);
    expect(query.compile().soql).toBe(
      "SELECT Id, Name, (SELECT Id, LastName, CreatedBy.Alias, toLabel(Salutation) salutationLabel FROM Contacts WHERE LastName LIKE 'A%' AND CreatedBy.Alias = 'x' ORDER BY LastName ASC NULLS LAST LIMIT 5) FROM Account",
    );
  });

  it("infers the nested Salesforce query-result shape", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName", "CreatedBy.Alias"])
          .select(({ fn }) => fn.toLabel("Salutation").as("salutationLabel")),
      );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
        readonly LastName: string;
        readonly CreatedBy: {
          readonly Alias: string | null;
        };
        readonly salutationLabel: string | null;
      }>;
    }>();
  });

  it("keeps coalesced child relationship unions fully queryable", () => {
    const query = new Kysoql<RepeatedChildRelationshipSchema>()
      .selectFrom("LegalEntity")
      .select("Id")
      .selectSubquery("FinanceBalanceSnapshots", (snapshots) =>
        snapshots.select(["Id", "ReferenceEntityId"]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, ReferenceEntityId FROM FinanceBalanceSnapshots) FROM LegalEntity",
    );
    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly FinanceBalanceSnapshots: SalesforceQueryResult<{
        readonly Id: string;
        readonly ReferenceEntityId: string | null;
      }>;
    }>();
  });

  it("selects typed field groups in relationship subqueries", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.selectFields("standard").selectFields("custom").limit(200),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT FIELDS(STANDARD), FIELDS(CUSTOM) FROM Contacts LIMIT 200) FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
        readonly LastName: string;
        readonly LifetimeValue__c: number | null;
        readonly Salutation: string | null;
        readonly AccountId: string | null;
        readonly CreatedById: string;
        readonly Internal_Note__c: string | null;
      }>;
    }>();
  });

  it("accepts Id-bounded unbounded field groups in relationship subqueries", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .selectFields("custom")
          .where("Id", "in", ["003A", "003B"]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT FIELDS(CUSTOM) FROM Contacts WHERE Id IN ('003A', '003B')) FROM Account",
    );
  });

  it("rejects unbounded relationship-subquery field groups in Apex", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .apex()
      .selectSubquery("Contacts", (contacts) =>
        contacts.selectFields("custom").limit(200),
      );

    expect(() => query.compile()).toThrow(
      "SOQL FIELDS(ALL) and FIELDS(CUSTOM) are not supported in Apex.",
    );
  });

  it("rejects unbounded custom field groups in relationship subqueries", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.selectFields("custom"),
      );

    expect(() => query.compile()).toThrow(
      "SOQL FIELDS(ALL) and FIELDS(CUSTOM) require LIMIT 200 or less or a WHERE Id filter bounded to 200 IDs or fewer.",
    );
  });

  it("selects converted currencies in relationship subqueries", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select(({ fn }) => [
          fn.convertCurrency("LifetimeValue__c").as("convertedLifetimeValue"),
          fn.convertCurrency("CreatedBy.Quota__c").as("convertedCreatorQuota"),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT convertCurrency(LifetimeValue__c) convertedLifetimeValue, convertCurrency(CreatedBy.Quota__c) convertedCreatorQuota FROM Contacts) FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly convertedLifetimeValue: number | null;
        readonly convertedCreatorQuota: number;
      }>;
    }>();
  });

  it("selects localized values in relationship subqueries", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select(({ fn }) => [
          fn.format("LifetimeValue__c").as("formattedLifetimeValue"),
          fn
            .format(fn.convertCurrency("LifetimeValue__c"))
            .as("formattedConvertedLifetimeValue"),
          fn.format("CreatedBy.Quota__c").as("formattedCreatorQuota"),
        ]),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT FORMAT(LifetimeValue__c) formattedLifetimeValue, FORMAT(convertCurrency(LifetimeValue__c)) formattedConvertedLifetimeValue, FORMAT(CreatedBy.Quota__c) formattedCreatorQuota FROM Contacts) FROM Account",
    );
    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly formattedLifetimeValue: string | null;
        readonly formattedConvertedLifetimeValue: string | null;
        readonly formattedCreatorQuota: string;
      }>;
    }>();
  });

  it("supports nested parent-to-child subqueries through four child levels", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .selectSubquery("Cases", (cases) =>
            cases
              .select("Id")
              .selectSubquery("Comments", (comments) =>
                comments
                  .select("Id")
                  .selectSubquery("Attachments", (attachments) =>
                    attachments.select(["Id", "Name"]),
                  ),
              ),
          ),
      );

    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, (SELECT Id, (SELECT Id, (SELECT Id, Name FROM Attachments) FROM Comments) FROM Cases) FROM Contacts) FROM Account",
    );

    expectTypeOf<Simplify<OutputOf<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Contacts: SalesforceQueryResult<{
        readonly Id: string;
        readonly Cases: SalesforceQueryResult<{
          readonly Id: string;
          readonly Comments: SalesforceQueryResult<{
            readonly Id: string;
            readonly Attachments: SalesforceQueryResult<{
              readonly Id: string;
              readonly Name: string;
            }>;
          }>;
        }>;
      }>;
    }>();
  });

  it("opts into relationship-subquery OFFSET through the pilot namespace", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select(["Id", "LastName"])
          .orderBy("LastName")
          .limit(10)
          .pilot.offset(5),
      )
      .limit(1);

    const subquery = query.toOperationNode().selections?.[1]?.selection;

    expect(subquery).toMatchObject({
      kind: "RelationshipSubqueryNode",
      limit: { kind: "LimitNode", limit: 10 },
      offset: { kind: "OffsetNode", offset: 5 },
    });
    expect(query.compile().soql).toBe(
      "SELECT Id, (SELECT Id, LastName FROM Contacts ORDER BY LastName LIMIT 10 OFFSET 5) FROM Account LIMIT 1",
    );
  });

  it("clears pilot relationship-subquery OFFSET immutably", () => {
    const db = new Kysoql<RelationshipSubquerySchema>();
    const withOffset = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").pilot.offset(5),
      )
      .limit(1);
    const cleared = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").pilot.offset(5).pilot.clearOffset(),
      );

    expect(withOffset.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts OFFSET 5) FROM Account LIMIT 1",
    );
    expect(cleared.compile().soql).toBe(
      "SELECT Id, (SELECT Id FROM Contacts) FROM Account",
    );
  });

  it("requires literal LIMIT 1 on the immediate parent of a pilot subquery OFFSET", () => {
    const db = new Kysoql<RelationshipSubquerySchema>();
    const withoutParentLimit = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").pilot.offset(1),
      );
    const withParentLimitTwo = withoutParentLimit.limit(2);

    expect(() => withoutParentLimit.compile()).toThrow(
      "SOQL relationship-subquery OFFSET pilot requires the immediate parent query to use a literal LIMIT 1.",
    );
    expect(() => withParentLimitTwo.compile()).toThrow(
      "SOQL relationship-subquery OFFSET pilot requires the immediate parent query to use a literal LIMIT 1.",
    );
  });

  it("applies the pilot LIMIT 1 rule recursively to nested relationship subqueries", () => {
    const db = new Kysoql<RelationshipSubquerySchema>();
    const valid = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts
          .select("Id")
          .selectSubquery("Cases", (cases) =>
            cases.select("Id").pilot.offset(2),
          )
          .limit(1),
      );
    const invalid = db
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").selectSubquery("Cases", (cases) =>
          cases.select("Id").pilot.offset(2),
        ),
      );

    expect(valid.compile().soql).toBe(
      "SELECT Id, (SELECT Id, (SELECT Id FROM Cases OFFSET 2) FROM Contacts LIMIT 1) FROM Account",
    );
    expect(() => invalid.compile()).toThrow(
      "SOQL relationship-subquery OFFSET pilot requires the immediate parent query to use a literal LIMIT 1.",
    );
  });

  it("validates pilot relationship-subquery OFFSET bounds", () => {
    const db = new Kysoql<RelationshipSubquerySchema>();

    expect(() =>
      db
        .selectFrom("Account")
        .select("Id")
        .selectSubquery("Contacts", (contacts) =>
          contacts.select("Id").pilot.offset(2001),
        ),
    ).toThrow("SOQL OFFSET must be a safe integer between 0 and 2000.");
  });

  it("rejects unknown relationships, invalid child fields, and unsupported capabilities", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id");

    query.selectSubquery("Contacts", (contacts) =>
      contacts.select("Id").where("LastName", "like", "A%").orderBy("LastName"),
    );

    void (() => {
      // @ts-expect-error Parent-to-child traversal must use generated child relationship names, not object names.
      query.selectSubquery("Contact", (contacts) => contacts.select("Id"));

      query.selectSubquery("Contacts", (contacts) => {
        // @ts-expect-error Child selections must exist on the generated child object.
        contacts.select("Does_Not_Exist__c");

        // @ts-expect-error Child filters retain generated filterable metadata.
        contacts.where("Internal_Note__c", "=", "private");

        // @ts-expect-error Child orderings retain generated sortable metadata.
        contacts.orderBy("Internal_Note__c");

        // @ts-expect-error Pilot subquery OFFSET stays off the ordinary production-safe builder surface.
        contacts.offset(1);

        contacts.pilot.offset(1);

        // @ts-expect-error Child SELECT functions retain generated field-type metadata.
        contacts.select(({ fn }) => fn.toLabel("LastName").as("lastNameLabel"));

        contacts.select(({ fn }) => {
          // @ts-expect-error Child currency conversion retains generated field-type metadata.
          return fn.convertCurrency("LastName").as("convertedLastName");
        });

        contacts.select(({ fn }) => {
          // @ts-expect-error Child localized formatting retains generated field-type metadata.
          return fn.format("LastName").as("formattedLastName");
        });

        return contacts.select("Id");
      });
    });
  });

  it("rejects explicit null placement for nullable reference ordering", () => {
    const db = new Kysoql<RelationshipSubquerySchema>();
    const contacts = db.selectFrom("Contact").select("Id");

    contacts.orderBy("AccountId");
    contacts.orderBy("CreatedById", "asc", "last");
    contacts.orderBy("Account.Name", "desc", "first");

    contacts.selectSubquery("Cases", (cases) => {
      cases.orderBy("ContactId");
      return cases.select("Id");
    });

    void (() => {
      // @ts-expect-error Salesforce does not support explicit NULLS placement for nullable reference fields.
      contacts.orderBy("AccountId", "asc", "last");

      contacts.selectSubquery("Cases", (cases) => {
        // @ts-expect-error Nullable relationship-subquery reference fields have the same NULLS restriction.
        cases.orderBy("ContactId", "desc", "first");
        return cases.select("Id");
      });
    });
  });

  it("requires each relationship subquery to select something", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id")
      .selectSubquery("Contacts", (contacts) => contacts);

    expect(() => query.compile()).toThrow(
      "Cannot compile a relationship subquery without selections.",
    );
  });

  it("rejects a fifth child traversal below the root query", () => {
    const query = new Kysoql<RelationshipSubquerySchema>()
      .selectFrom("Account")
      .select("Id");

    void (() => {
      query.selectSubquery("Contacts", (contacts) =>
        contacts.select("Id").selectSubquery("Cases", (cases) =>
          cases.select("Id").selectSubquery("Comments", (comments) =>
            comments
              .select("Id")
              .selectSubquery("Attachments", (attachments) => {
                const selected = attachments.select("Id");

                // @ts-expect-error API 58+ REST/SOAP relationship queries allow four child traversals below the root (five total levels).
                return selected.selectSubquery("Tags", (tags) => tags);
              }),
          ),
        ),
      );
    });
  });
});
