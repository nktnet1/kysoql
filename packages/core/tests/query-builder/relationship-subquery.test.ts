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

interface RelationshipSubquerySchema {
  readonly Account: SalesforceObject<
    {
      readonly Id: SalesforceField<string, "id", false, true, true, true>;
      readonly Name: SalesforceField<string, "string", true, true, true, true>;
    },
    Record<never, never>,
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
      readonly Internal_Note__c: SalesforceField<
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

        // @ts-expect-error Subquery OFFSET is intentionally not exposed because Salesforce documents it as a conditional pilot feature.
        contacts.offset(1);

        // @ts-expect-error Child SELECT functions retain generated field-type metadata.
        contacts.select(({ fn }) => fn.toLabel("LastName").as("lastNameLabel"));

        return contacts.select("Id");
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
