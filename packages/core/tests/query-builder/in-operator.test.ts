import { describe, expect, it } from "vitest";

import { Kysoql } from "#src/kysoql";
import type { SalesforceField, SalesforceObject } from "#src/schema";
import { soqlDate } from "#src/soql-temporal-literal";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
    readonly AnnualRevenue: SalesforceField<
      number,
      "currency",
      true,
      true,
      true,
      true
    >;
    readonly CloseDate: SalesforceField<string, "date", true, true, true, true>;
  }>;
}

describe("IN and NOT IN filters", () => {
  it("stores immutable typed value lists in the filter AST", () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .where("Name", "in", ["Acme", "Global Media"])
      .where((eb) => eb("AnnualRevenue", "not in", [100, 200]));

    const where = query.toOperationNode().where;

    expect(where?.where).toEqual({
      kind: "AndNode",
      left: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "Name" },
        operator: { kind: "OperatorNode", operator: "in" },
        rightOperand: {
          kind: "ValueListNode",
          values: [
            { kind: "ValueNode", value: "Acme" },
            { kind: "ValueNode", value: "Global Media" },
          ],
        },
      },
      right: {
        kind: "BinaryOperationNode",
        leftOperand: { kind: "ReferenceNode", name: "AnnualRevenue" },
        operator: { kind: "OperatorNode", operator: "not in" },
        rightOperand: {
          kind: "ValueListNode",
          values: [
            { kind: "ValueNode", value: 100 },
            { kind: "ValueNode", value: 200 },
          ],
        },
      },
    });
    expect(Object.isFrozen(where?.where)).toBe(true);
  });

  it("rejects empty value lists at runtime", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    expect(() => query.where("Name", "in", [])).toThrow(
      "SOQL IN/NOT IN value lists must contain at least one value.",
    );
    expect(() => query.where("Name", "not in", [])).toThrow(
      "SOQL IN/NOT IN value lists must contain at least one value.",
    );
  });

  it("preserves field-aware value types for value lists", () => {
    const query = new Kysoql<FixtureSchema>().selectFrom("Account");

    query.where("Name", "in", ["Acme", "Global Media"]);
    query.where("AnnualRevenue", "not in", [100, 200]);
    query.where("CloseDate", "in", [
      soqlDate("2026-01-01"),
      soqlDate("2026-12-31"),
    ]);
    query.where((eb) => eb("Name", "not in", ["Acme", null]));

    void (() => {
      // @ts-expect-error IN requires a value list rather than one scalar value.
      query.where("Name", "in", "Acme");

      // @ts-expect-error Number fields require numeric members in IN value lists.
      query.where("AnnualRevenue", "in", [100, "200"]);

      // @ts-expect-error Date fields require explicit SOQL date literals in value lists.
      query.where("CloseDate", "in", ["2026-01-01"]);

      // @ts-expect-error Non-nullable fields reject null members in value lists.
      query.where("Id", "not in", ["001000000000001", null]);

      query.where((eb) =>
        eb.or([
          eb("Name", "in", ["Acme", "Global Media"]),
          // @ts-expect-error Expression-builder IN preserves field-aware member types.
          eb("AnnualRevenue", "not in", [100, "200"]),
        ]),
      );
    });
  });
});
