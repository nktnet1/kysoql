import { describe, expect, expectTypeOf, it } from "vitest";

import type { SelectQueryNode } from "#/operation-node/select-query-node";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { QueryCreator } from "#/query-creator";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";
import type { SalesforceField, SalesforceObject } from "#/schema";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
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

class RecordingExecutor implements QueryExecutor {
  readonly calls: Array<{
    readonly compiledQuery: CompiledQuery<unknown>;
    readonly options: AbortableQueryOptions | undefined;
  }> = [];

  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]> {
    this.calls.push({
      compiledQuery: compiledQuery as CompiledQuery<unknown>,
      options,
    });
    return [{ Id: "001", Name: "Acme" }] as unknown as readonly O[];
  }

  async executeCountQuery(
    compiledQuery: CompiledQuery<number>,
    options?: AbortableQueryOptions,
  ): Promise<number> {
    this.calls.push({
      compiledQuery: compiledQuery as CompiledQuery<unknown>,
      options,
    });
    return 42;
  }
}

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

  it("executes an already compiled query and preserves result aliases", async () => {
    const executor = new RecordingExecutor();
    const db = new QueryCreator<FixtureSchema>({ executor });
    const compiled = db
      .selectFrom("Account")
      .select(["Id as accountId", "Name as name"])
      .compile();
    const options = {} satisfies AbortableQueryOptions;

    const result = db.executeQuery(compiled, options);
    expectTypeOf(result).toEqualTypeOf<
      Promise<
        readonly { readonly accountId: string; readonly name: string | null }[]
      >
    >();
    await expect(result).resolves.toEqual([{ accountId: "001", name: "Acme" }]);
    expect(executor.calls).toEqual([{ compiledQuery: compiled, options }]);
  });

  it("dispatches compiled bare COUNT() queries to scalar count execution", async () => {
    const executor = new RecordingExecutor();
    const db = new QueryCreator<FixtureSchema>({ executor });
    const compiled = db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .compile();

    const result = db.executeQuery(compiled);
    expectTypeOf(result).toEqualTypeOf<Promise<number>>();
    await expect(result).resolves.toBe(42);
    expect(executor.calls).toEqual([
      { compiledQuery: compiled, options: undefined },
    ]);
  });

  it("rejects root-level execution when no executor is configured", async () => {
    const db = new QueryCreator<FixtureSchema>();
    const compiled = db.selectFrom("Account").select("Id").compile();

    await expect(db.executeQuery(compiled)).rejects.toThrow(
      "No query executor configured",
    );
  });
});
