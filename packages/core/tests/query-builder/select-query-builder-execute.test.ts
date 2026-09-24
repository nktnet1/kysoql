import { describe, expect, expectTypeOf, it } from "vitest";
import { Kysoql } from "#/kysoql";
import type { SelectQueryNode } from "#/operation-node/select-query-node";
import { NoResultError } from "#/query-builder/no-result-error";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type {
  AbortableQueryOptions,
  QueryAbortSignal,
  QueryExecutor,
} from "#/query-executor";
import type { SalesforceField, SalesforceObject } from "#/schema";
import type { Simplify } from "#/util/type-utils";

interface FixtureSchema {
  readonly Account: SalesforceObject<{
    readonly Id: SalesforceField<string, "id", false, true, true, true>;
    readonly Name: SalesforceField<string, "string", true, true, true, true>;
  }>;
}

type ExecutedRow<Query> = Query extends {
  execute(): Promise<readonly (infer Output)[]>;
}
  ? Output
  : never;

type ExecutedAllRow<Query> = Query extends {
  executeAll(): Promise<readonly (infer Output)[]>;
}
  ? Output
  : never;

class RecordingExecutor implements QueryExecutor {
  readonly calls: Array<{ readonly soql: string; readonly query: unknown }> =
    [];
  readonly allCalls: Array<{ readonly soql: string; readonly query: unknown }> =
    [];
  readonly options: Array<AbortableQueryOptions | undefined> = [];

  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]> {
    this.options.push(options);
    this.calls.push({
      query: compiledQuery.query,
      soql: compiledQuery.soql,
    });

    return [
      {
        Id: "001000000000001",
        Name: "Acme",
      },
    ] as unknown as readonly O[];
  }

  async executeAllQuery<O>(
    compiledQuery: CompiledQuery<O>,
    options?: AbortableQueryOptions,
  ): Promise<readonly O[]> {
    this.options.push(options);
    this.allCalls.push({
      query: compiledQuery.query,
      soql: compiledQuery.soql,
    });

    return [
      {
        Id: "001000000000002",
        Name: "Deleted Acme",
      },
    ] as unknown as readonly O[];
  }
}

describe("SelectQueryBuilder.execute", () => {
  it("compiles and delegates execution without losing the selected output type", async () => {
    const executor = new RecordingExecutor();
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "like", "Acme%");

    await expect(query.execute()).resolves.toEqual([
      {
        Id: "001000000000001",
        Name: "Acme",
      },
    ]);

    expect(executor.calls).toEqual([
      {
        query: query.toOperationNode(),
        soql: "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%'",
      },
    ]);

    expectTypeOf<Simplify<ExecutedRow<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });

  it("maps Kysely-style field aliases after a custom executor returns Salesforce fields", async () => {
    const executor = new RecordingExecutor();
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select(["Id as id", "Id as accountId", "Name as name"]);

    await expect(query.execute()).resolves.toEqual([
      {
        accountId: "001000000000001",
        id: "001000000000001",
        name: "Acme",
      },
    ]);
    expect(query.compile().soql).toBe("SELECT Id, Name FROM Account");

    expectTypeOf<Simplify<ExecutedRow<typeof query>>>().toEqualTypeOf<{
      readonly accountId: string;
      readonly id: string;
      readonly name: string | null;
    }>();
  });

  it("mirrors Kysely executeTakeFirst and executeTakeFirstOrThrow semantics", async () => {
    const executor = new RecordingExecutor();
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select(["Id", "Name"]);

    await expect(query.executeTakeFirst()).resolves.toEqual({
      Id: "001000000000001",
      Name: "Acme",
    });
    await expect(query.executeTakeFirstOrThrow()).resolves.toEqual({
      Id: "001000000000001",
      Name: "Acme",
    });

    const emptyExecutor: QueryExecutor = {
      executeQuery: async () => [],
    };
    const emptyQuery = new Kysoql<FixtureSchema>({ executor: emptyExecutor })
      .selectFrom("Account")
      .select("Id");

    await expect(emptyQuery.executeTakeFirst()).resolves.toBeUndefined();

    const defaultError = await emptyQuery
      .executeTakeFirstOrThrow()
      .catch((error: unknown) => error);
    expect(defaultError).toBeInstanceOf(NoResultError);
    expect((defaultError as NoResultError).node).toBe(
      emptyQuery.toOperationNode(),
    );

    class MissingAccountError extends Error {
      readonly node: SelectQueryNode;

      constructor(node: SelectQueryNode) {
        super("missing account");
        this.node = node;
      }
    }

    await expect(
      emptyQuery.executeTakeFirstOrThrow(MissingAccountError),
    ).rejects.toBeInstanceOf(MissingAccountError);
    await expect(
      emptyQuery.executeTakeFirstOrThrow(() => new Error("custom missing")),
    ).rejects.toThrow("custom missing");
  });

  it("passes abort options through the builder execution surface", async () => {
    const executor = new RecordingExecutor();
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select("Id");
    const signal: QueryAbortSignal = {
      aborted: false,
      reason: undefined,
      throwIfAborted: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    await query.execute({ signal });
    await query.executeTakeFirst({ signal });
    await query.executeTakeFirstOrThrow({ signal });
    await query.executeAll({ signal });

    expect(executor.options).toEqual([
      { signal },
      { signal },
      { signal },
      { signal },
    ]);
  });

  it("keeps compile-only builders usable while rejecting execution without an executor", async () => {
    const query = new Kysoql<FixtureSchema>()
      .selectFrom("Account")
      .select("Id");

    expect(query.compile().soql).toBe("SELECT Id FROM Account");
    await expect(query.execute()).rejects.toThrow(
      "No query executor configured. Pass an executor when creating Kysoql.",
    );
    await expect(query.executeAll()).rejects.toThrow(
      "No query executor configured. Pass an executor when creating Kysoql.",
    );
  });

  it("delegates Salesforce QueryAll execution without losing the selected output type", async () => {
    const executor = new RecordingExecutor();
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select(["Id", "Name"])
      .where("Name", "like", "Acme%");

    await expect(query.executeAll()).resolves.toEqual([
      {
        Id: "001000000000002",
        Name: "Deleted Acme",
      },
    ]);

    expect(executor.allCalls).toEqual([
      {
        query: query.toOperationNode(),
        soql: "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%'",
      },
    ]);
    expect(executor.calls).toEqual([]);

    expectTypeOf<Simplify<ExecutedAllRow<typeof query>>>().toEqualTypeOf<{
      readonly Id: string;
      readonly Name: string | null;
    }>();
  });

  it("reports executors that do not implement Salesforce QueryAll execution", async () => {
    const executor: QueryExecutor = {
      executeQuery: async () => [],
    };
    const query = new Kysoql<FixtureSchema>({ executor })
      .selectFrom("Account")
      .select("Id");

    await expect(query.executeAll()).rejects.toThrow(
      "The configured query executor does not support Salesforce QueryAll execution.",
    );
  });
});
