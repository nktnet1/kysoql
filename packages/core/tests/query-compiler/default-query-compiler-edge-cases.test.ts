import { describe, expect, it } from "vitest";
import { Kysoql } from "#/kysoql";
import { BinaryOperationNode } from "#/operation-node/binary-operation-node";
import type { OperationNode } from "#/operation-node/operation-node";
import { OperatorNode } from "#/operation-node/operator-node";
import { ReferenceNode } from "#/operation-node/reference-node";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import { SelectionNode } from "#/operation-node/selection-node";
import { SObjectNode } from "#/operation-node/sobject-node";
import { ValueNode } from "#/operation-node/value-node";
import { WhereNode } from "#/operation-node/where-node";
import { DefaultQueryCompiler } from "#/query-compiler/default-query-compiler";
import type { SalesforceField, SalesforceObject } from "#/schema";

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
    readonly Active__c: SalesforceField<
      boolean,
      "boolean",
      false,
      true,
      true,
      true
    >;
  }>;
}

const manualQuery = (where: OperationNode): SelectQueryNode => ({
  kind: "SelectQueryNode",
  from: SObjectNode.create("Account"),
  selections: [SelectionNode.create(ReferenceNode.create("Id"))],
  where: WhereNode.create(where),
});

describe("DefaultQueryCompiler edge cases", () => {
  it("compiles false booleans and finite numeric forms", () => {
    const booleanQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Active__c", "=", false)
      .compile();
    const numericQuery = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("AnnualRevenue", "=", -123.5)
      .compile();

    expect(booleanQuery.soql).toBe(
      "SELECT Id FROM Account WHERE Active__c = FALSE",
    );
    expect(numericQuery.soql).toBe(
      "SELECT Id FROM Account WHERE AnnualRevenue = -123.5",
    );
  });

  it("compiles empty strings", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Name", "=", "")
      .compile();

    expect(compiled.soql).toBe("SELECT Id FROM Account WHERE Name = ''");
  });

  it("escapes every SOQL string control character", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Name", "=", "quote' slash\\ line\ncarriage\r tab\t back\b form\f")
      .compile();

    expect(compiled.soql).toBe(
      String.raw`SELECT Id FROM Account WHERE Name = ` +
        String.raw`'quote\' slash\\ line\ncarriage\r tab\t back\b form\f'`,
    );
  });

  it("preserves escaped LIKE wildcards and escapes ordinary backslashes", () => {
    const compiled = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id")
      .where("Name", "like", String.raw`A\%B\_C\\D`)
      .compile();

    expect(compiled.soql).toBe(
      String.raw`SELECT Id FROM Account WHERE Name LIKE 'A\%B\_C\\\\D'`,
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite numeric literals: %s",
    (value) => {
      expect(() =>
        new Kysoql<FixtureSchema>()
          .selectFrom("Account")
          .select("Id")
          .where("AnnualRevenue", "=", value)
          .compile(),
      ).toThrow("SOQL numeric literals must be finite numbers.");
    },
  );

  it.each([
    ["undefined", undefined],
    ["bigint", 1n],
    ["symbol", Symbol("value")],
    ["function", () => undefined],
  ] as const)("rejects unsupported %s literal values", (type, value) => {
    const compiler = new DefaultQueryCompiler();

    expect(() =>
      compiler.compileQuery(manualQuery(ValueNode.create(value))),
    ).toThrow(`Unsupported SOQL literal type: ${type}`);
  });

  it("compiles non-value right operands supplied by an operation tree", () => {
    const compiler = new DefaultQueryCompiler();
    const comparison = BinaryOperationNode.create(
      ReferenceNode.create("Name"),
      OperatorNode.create("="),
      ReferenceNode.create("Id"),
    );

    expect(compiler.compileQuery(manualQuery(comparison)).soql).toBe(
      "SELECT Id FROM Account WHERE Name = Id",
    );
  });

  it("compiles standalone operator operation nodes", () => {
    const compiler = new DefaultQueryCompiler();

    const compiled = compiler.compileQuery(
      manualQuery(OperatorNode.create("=")),
    );

    expect(compiled.soql).toBe("SELECT Id FROM Account WHERE =");
  });

  it("rejects operation node kinds the compiler does not understand", () => {
    const compiler = new DefaultQueryCompiler();

    expect(() =>
      compiler.compileQuery(manualQuery({ kind: "UnsupportedNode" })),
    ).toThrow("Unsupported operation node: UnsupportedNode");
  });
});
