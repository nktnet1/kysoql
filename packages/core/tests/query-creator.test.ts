import { describe, expect, expectTypeOf, it } from "vitest";

import { Kysoql } from "#/kysoql";
import { LimitNode } from "#/operation-node/limit-node";
import { SelectQueryNode } from "#/operation-node/select-query-node";
import type { KysoqlPlugin, PluginTransformResultArgs } from "#/plugin";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryCompiler } from "#/query-compiler/query-compiler";
import { QueryCreator } from "#/query-creator";
import type { AbortableQueryOptions, QueryExecutor } from "#/query-executor";
import type { QueryId } from "#/query-id";
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

describe("QueryCreator plugins", () => {
  const limitPlugin = (limit: number, calls: string[]): KysoqlPlugin => ({
    transformQuery({ query }) {
      calls.push(`query:${limit}`);
      return SelectQueryNode.cloneWithLimit(query, LimitNode.create(limit));
    },
    transformResult<Result>({
      result,
    }: PluginTransformResultArgs<Result>): Result {
      calls.push(`result:${limit}`);
      return result;
    },
  });

  it("applies query plugins to toOperationNode without changing compile semantics", () => {
    const calls: string[] = [];
    const db = new QueryCreator<FixtureSchema>().withPlugin(
      limitPlugin(7, calls),
    );
    const query = db.selectFrom("Account").select("Id");

    expect(query.toOperationNode().limit?.limit).toBe(7);
    expect(calls).toEqual(["query:7"]);

    calls.length = 0;
    expect(query.compile().soql).toContain("LIMIT 7");
    expect(calls).toEqual(["query:7"]);
  });

  it("applies query and result plugins in registration order", async () => {
    const calls: string[] = [];
    const executor = new RecordingExecutor();
    const db = new QueryCreator<FixtureSchema>({ executor })
      .withPlugin(limitPlugin(10, calls))
      .withPlugin(limitPlugin(5, calls));

    const query = db.selectFrom("Account").select("Id");
    const compiled = query.compile();

    expect(compiled.soql).toContain("LIMIT 5");
    expect(calls).toEqual(["query:10", "query:5"]);

    calls.length = 0;
    await query.execute();
    expect(calls).toEqual(["query:10", "query:5", "result:10", "result:5"]);
  });

  it("correlates query and result plugin hooks with a stable query id", async () => {
    const queryIds: QueryId[] = [];
    const resultIds: QueryId[] = [];
    const plugin: KysoqlPlugin = {
      transformQuery({ queryId, query }) {
        queryIds.push(queryId);
        return query;
      },
      transformResult<Result>({
        queryId,
        result,
      }: PluginTransformResultArgs<Result>): Result {
        resultIds.push(queryId);
        return result;
      },
    };
    const db = new QueryCreator<FixtureSchema>({
      executor: new RecordingExecutor(),
    }).withPlugin(plugin);

    const first = db.selectFrom("Account").select("Id").compile();
    const second = db.selectFrom("Account").select("Id").compile();

    await Promise.all([db.executeQuery(first), db.executeQuery(second)]);

    expect(queryIds).toHaveLength(2);
    expect(queryIds[0]).not.toBe(queryIds[1]);
    expect(resultIds).toEqual(queryIds);
    expect(resultIds[0]?.queryId).toMatch(/^kysoql-\d+$/);
  });

  it("preserves the concrete Kysoql creator type", () => {
    const db = new Kysoql<FixtureSchema>();
    const plugged = db.withPlugin(limitPlugin(1, []));

    expect(plugged).toBeInstanceOf(Kysoql);
    expectTypeOf(plugged).toEqualTypeOf<Kysoql<FixtureSchema>>();
  });

  it("leaves the original creator unchanged and can remove plugins", () => {
    const calls: string[] = [];
    const db = new QueryCreator<FixtureSchema>();
    const withPlugin = db.withPlugin(limitPlugin(1, calls));

    expect(db.selectFrom("Account").select("Id").compile().soql).not.toContain(
      "LIMIT 1",
    );
    expect(
      withPlugin.selectFrom("Account").select("Id").compile().soql,
    ).toContain("LIMIT 1");
    expect(
      withPlugin.withoutPlugins().selectFrom("Account").select("Id").compile()
        .soql,
    ).not.toContain("LIMIT 1");
  });

  it("transforms scalar COUNT() results", async () => {
    const plugin: KysoqlPlugin = {
      transformQuery: ({ query }) => query,
      transformResult<Result>({
        result,
      }: PluginTransformResultArgs<Result>): Result {
        return (typeof result === "number" ? result + 1 : result) as Result;
      },
    };
    const db = new QueryCreator<FixtureSchema>({
      executor: new RecordingExecutor(),
    }).withPlugin(plugin);

    await expect(
      db
        .selectFrom("Account")
        .select(({ fn }) => fn.count())
        .execute(),
    ).resolves.toBe(43);
  });
});

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
