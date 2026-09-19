import { describe, expect, expectTypeOf, it } from "vitest";
import { Kysoql } from "#/kysoql";
import type { CompiledQuery } from "#/query-compiler/compiled-query";
import type { QueryExecutor } from "#/query-executor";
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

  async executeQuery<O>(
    compiledQuery: CompiledQuery<O>,
  ): Promise<readonly O[]> {
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
  ): Promise<readonly O[]> {
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
