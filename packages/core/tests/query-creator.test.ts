import { describe, expect, it } from "vitest";

import type {
  SelectQueryNode,
} from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { QueryCreator } from "#/query-creator";
import type { SalesforceField, SalesforceObject } from "#/schema";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
  }>;
}

const customCompiler: QueryCompiler = {
  compileQuery<O>(query: SelectQueryNode): CompiledQuery<O> {
    return {
      query,
      soql: `CUSTOM ${query.from.name}`,
    };
  },
};

describe("QueryCreator", () => {
  it("uses the default compiler when constructed without config", () => {
    const query = new QueryCreator<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");

    expect(query.compile().soql).toBe("SELECT Id FROM Account");
  });

  it("accepts the legacy direct QueryCompiler constructor form", () => {
    const query = new QueryCreator<FixtureSchema>(customCompiler)
      .selectFrom("Account")
      .select("Id");

    expect(query.compile()).toEqual({
      query: query.toOperationNode(),
      soql: "CUSTOM Account",
    });
  });

  it("accepts a QueryCompiler through the config object", () => {
    const query = new QueryCreator<FixtureSchema>({
      queryCompiler: customCompiler,
    })
      .selectFrom("Account")
      .select("Id");

    expect(query.compile().soql).toBe("CUSTOM Account");
  });

  it("creates a frozen query node for the selected Salesforce object", () => {
    const query = new QueryCreator<FixtureSchema>().selectFrom("Account");
    const node = query.toOperationNode();

    expect(node).toEqual({
      kind: "SelectQueryNode",
      from: { kind: "SObjectNode", name: "Account" },
    });
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.from)).toBe(true);
  });
});
