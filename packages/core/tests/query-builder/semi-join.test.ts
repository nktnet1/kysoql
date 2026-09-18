import { describe, expect, it } from "vitest";

import { Kysoql } from "#/kysoql";
import type {
  SalesforceChildRelationship,
  SalesforceField,
  SalesforceObject,
  SalesforceParentRelationship,
} from "#/schema";

interface SemiJoinSchema {
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
      readonly LastName: SalesforceField<
        string,
        "string",
        false,
        true,
        true,
        true
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
  readonly Opportunity: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
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
    readonly StageName: SalesforceField<
      string,
      "picklist",
      false,
      true,
      true,
      true
    >;
  }>;
  readonly Case: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
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
    readonly Status: SalesforceField<
      string,
      "picklist",
      false,
      true,
      true,
      true
    >;
  }>;
  readonly Lead: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly LastName: SalesforceField<
      string,
      "string",
      false,
      true,
      true,
      true
    >;
  }>;
  readonly Task: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly WhoId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "Contact" | "Lead"
    >;
    readonly WhatId: SalesforceField<
      string,
      "reference",
      true,
      true,
      true,
      true,
      "Account"
    >;
  }>;
}

describe("semi-join and anti-join filters", () => {
  it("stores typed semi-join and anti-join subqueries in the filter AST", () => {
    const query = new Kysoql<SemiJoinSchema>()
      .selectFrom("Account")
      .where("Id", "in", (subquery) =>
        subquery
          .selectFrom("Opportunity")
          .select("AccountId")
          .where("StageName", "=", "Closed Won"),
      )
      .where((eb) =>
        eb("Id", "not in", (subquery) =>
          subquery
            .selectFrom("Contact")
            .where("LastName", "like", "Test%")
            .select("AccountId"),
        ),
      );

    expect(query.toOperationNode().where?.where).toEqual({
      kind: "AndNode",
      left: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Id" },
        operator: { kind: "OperatorNode", operator: "in" },
        rightOperand: {
          kind: "SemiJoinSubqueryNode",
          from: { kind: "SObjectNode", name: "Opportunity" },
          selection: { kind: "ReferenceNode", name: "AccountId" },
          where: {
            kind: "WhereNode",
            where: {
              kind: "BinaryOperationNode",
              leftOperand: { kind: "ReferenceNode", name: "StageName" },
              operator: { kind: "OperatorNode", operator: "=" },
              rightOperand: { kind: "ValueNode", value: "Closed Won" },
            },
          },
        },
      },
      right: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Id" },
        operator: { kind: "OperatorNode", operator: "not in" },
        rightOperand: {
          kind: "SemiJoinSubqueryNode",
          from: { kind: "SObjectNode", name: "Contact" },
          selection: { kind: "ReferenceNode", name: "AccountId" },
          where: {
            kind: "WhereNode",
            where: {
              kind: "BinaryOperationNode",
              leftOperand: { kind: "ReferenceNode", name: "LastName" },
              operator: { kind: "OperatorNode", operator: "like" },
              rightOperand: { kind: "ValueNode", value: "Test%" },
            },
          },
        },
      },
    });
    expect(Object.isFrozen(query.toOperationNode().where?.where)).toBe(true);
  });

  it("supports ID/reference compatibility including polymorphic references", () => {
    const db = new Kysoql<SemiJoinSchema>();

    db.selectFrom("Opportunity").where("AccountId", "in", (subquery) =>
      subquery.selectFrom("Account").select("Id"),
    );

    db.selectFrom("Task").where("WhoId", "in", (subquery) =>
      subquery.selectFrom("Contact").select("Id"),
    );

    db.selectFrom("Opportunity").where("ContactId", "not in", (subquery) =>
      subquery.selectFrom("Case").select("ContactId"),
    );

    db.selectFrom("Account").where((eb) =>
      eb.and([
        eb("Id", "in", (subquery) =>
          subquery.selectFrom("Opportunity").select("AccountId"),
        ),
        eb("Name", "=", "Acme"),
      ]),
    );
  });

  it("keeps semi-joins at the top-level WHERE and limits a query to two", () => {
    const base = new Kysoql<SemiJoinSchema>().selectFrom("Account");
    const first = base.where("Id", "in", (subquery) =>
      subquery.selectFrom("Opportunity").select("AccountId"),
    );
    const second = first.where("Id", "not in", (subquery) =>
      subquery.selectFrom("Contact").select("AccountId"),
    );

    expect(() =>
      second.where("Id", "in", (subquery) =>
        subquery.selectFrom("Case").select("AccountId"),
      ),
    ).toThrow(
      "SOQL WHERE clauses support at most two semi-join or anti-join subqueries.",
    );
  });

  it("enforces semi-join field, object, selection, and nesting restrictions", () => {
    const db = new Kysoql<SemiJoinSchema>();
    const accountQuery = db.selectFrom("Account");
    const contactQuery = db.selectFrom("Contact");

    void (() => {
      // @ts-expect-error Semi-join left operands must be ID or reference fields.
      accountQuery.where("Name", "in", (subquery) =>
        subquery.selectFrom("Opportunity").select("AccountId"),
      );

      // @ts-expect-error Semi-join left operands cannot traverse parent relationships.
      contactQuery.where("Account.Id", "in", (subquery) =>
        subquery.selectFrom("Opportunity").select("AccountId"),
      );

      // @ts-expect-error A semi-join/anti-join callback must return a subquery with one selected field.
      accountQuery.where("Id", "in", (subquery) =>
        subquery.selectFrom("Opportunity"),
      );

      accountQuery.where("Id", "in", (subquery) => {
        // @ts-expect-error A semi-join subquery cannot query the same object as the outer query.
        subquery.selectFrom("Account");

        // @ts-expect-error Task is not supported as a semi-join subquery object by Salesforce.
        subquery.selectFrom("Task");

        const opportunity = subquery.selectFrom("Opportunity");

        // @ts-expect-error Selected fields must be ID/reference fields compatible with the outer operand.
        opportunity.select("StageName");

        // @ts-expect-error ContactId identifies Contact records, not Account records.
        opportunity.select("ContactId");

        const selected = opportunity.select("AccountId");

        // @ts-expect-error Semi-join subqueries select exactly one field.
        selected.select("AccountId");

        // @ts-expect-error ORDER BY is not supported in semi-join subqueries.
        selected.orderBy("AccountId");

        // @ts-expect-error LIMIT is not supported in semi-join subqueries.
        selected.limit(1);

        // @ts-expect-error Semi-joins cannot be nested inside semi-join subquery WHERE clauses.
        selected.where("ContactId", "in", (nested) =>
          nested.selectFrom("Case").select("ContactId"),
        );

        return selected;
      });

      accountQuery.where((eb) => {
        const semiJoin = eb("Id", "in", (subquery) =>
          subquery.selectFrom("Opportunity").select("AccountId"),
        );

        // @ts-expect-error Semi-join expressions cannot be nested under OR.
        return eb.or([semiJoin, eb("Name", "=", "Acme")]);
      });

      accountQuery.where((eb) => {
        const semiJoin = eb("Id", "not in", (subquery) =>
          subquery.selectFrom("Contact").select("AccountId"),
        );

        // @ts-expect-error NOT cannot wrap a semi-join or anti-join expression.
        return eb.not(semiJoin);
      });

      accountQuery.selectSubquery("Contacts", (contacts) => {
        // @ts-expect-error Semi-joins are not supported inside relationship-subquery WHERE clauses.
        contacts.where("AccountId", "in", (subquery) =>
          subquery.selectFrom("Opportunity").select("AccountId"),
        );

        return contacts.select("Id");
      });
    });
  });
});
