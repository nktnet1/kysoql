import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import type { SalesforceField, SalesforceObject } from "#src/schema";
import { soqlMultiSelectAnd } from "#src/soql-multi-select-literal";

type MultiPicklistField = SalesforceField<
  string,
  "multipicklist",
  true,
  true,
  true,
  true,
  never,
  never,
  "Alpha" | "Beta" | "Gamma"
>;

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
    readonly Tags__c: MultiPicklistField;
  }>;
}

describe("INCLUDES and EXCLUDES filters", () => {
  it("stores typed multipicklist value lists in the filter AST", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .where("Tags__c", "includes", ["Alpha", "Beta"])
      .where((eb) => eb("Tags__c", "excludes", ["Gamma"]));

    expect(query.toOperationNode().where?.where).toEqual({
      kind: "AndNode",
      left: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Tags__c" },
        operator: { kind: "OperatorNode", operator: "includes" },
        rightOperand: {
          kind: "ValueListNode",
          values: [
            { kind: "ValueNode", value: "Alpha" },
            { kind: "ValueNode", value: "Beta" },
          ],
        },
      },
      right: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Tags__c" },
        operator: { kind: "OperatorNode", operator: "excludes" },
        rightOperand: {
          kind: "ValueListNode",
          values: [{ kind: "ValueNode", value: "Gamma" }],
        },
      },
    });
  });

  it("supports Salesforce semicolon AND semantics with typed picklist values", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .where("Tags__c", "includes", soqlMultiSelectAnd("Alpha", "Beta"));

    expect(query.toOperationNode().where?.where).toEqual({
      kind: "BinaryOperationNode",
      leftOperand: { kind: "ReferenceNode", name: "Tags__c" },
      operator: { kind: "OperatorNode", operator: "includes" },
      rightOperand: {
        kind: "ValueListNode",
        values: [{ kind: "ValueNode", value: "Alpha;Beta" }],
      },
    });

    query.where("Tags__c", "includes", [
      soqlMultiSelectAnd("Alpha", "Beta"),
      "Gamma",
    ]);

    void (() => {
      query.where(
        "Tags__c",
        "includes",
        // @ts-expect-error Every AND member is constrained to active picklist values.
        soqlMultiSelectAnd("Alpha", "Retired"),
      );

      query.where("Tags__c", "includes", [
        // @ts-expect-error Mixed groups remain constrained to active picklist values.
        soqlMultiSelectAnd("Alpha", "Retired"),
        "Gamma",
      ]);
    });
  });

  it("rejects empty multipicklist value lists at runtime", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    expect(() => query.where("Tags__c", "includes", [])).toThrow(
      "SOQL INCLUDES/EXCLUDES value lists must contain at least one value.",
    );
    expect(() => query.where("Tags__c", "excludes", [])).toThrow(
      "SOQL INCLUDES/EXCLUDES value lists must contain at least one value.",
    );
  });

  it("restricts the operators and members to multipicklist metadata", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    query.where("Tags__c", "includes", ["Alpha"]);
    query.where("Tags__c", "excludes", ["Beta", "Gamma"]);
    query.where((eb) => eb("Tags__c", "includes", ["Gamma"]));

    void (() => {
      // @ts-expect-error INCLUDES is only available for multipicklist fields.
      query.where("Name", "includes", ["Alpha"]);

      // @ts-expect-error EXCLUDES is only available for multipicklist fields.
      query.where("Name", "excludes", ["Alpha"]);

      // @ts-expect-error Members are constrained to generated active picklist values.
      query.where("Tags__c", "includes", ["Retired"]);

      // @ts-expect-error INCLUDES requires a value list rather than one scalar value.
      query.where("Tags__c", "includes", "Alpha");

      query.where((eb) =>
        eb.or([
          eb("Tags__c", "includes", ["Alpha"]),
          // @ts-expect-error Expression-builder operands preserve active-value typing.
          eb("Tags__c", "excludes", ["Retired"]),
        ]),
      );
    });
  });
});
