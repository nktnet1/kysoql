import type { CompiledQuery, ReferenceNode } from "@kysoql/core";
import type { Connection } from "jsforce";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createJsforceExecutor,
  type JsforceConnection,
  type JsforceCountQueryResult,
  type JsforceExecutor,
  type JsforceQueryResult,
} from "#/index";

const referenceNode = (name: string): ReferenceNode => ({
  kind: "ReferenceNode",
  name,
});

interface AccountRow {
  readonly Id: string;
  readonly Name: string | null;
}

const compiledQuery = {
  query: {} as CompiledQuery<AccountRow>["query"],
  soql: "SELECT Id, Name FROM Account",
} satisfies CompiledQuery<AccountRow>;

const compiledAliasQuery = {
  query: {
    kind: "SelectQueryNode",
    from: { kind: "SObjectNode", name: "Account" },
    selections: [
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "id",
          node: referenceNode("Id"),
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "AliasNode",
          alias: "name",
          node: referenceNode("Name"),
        },
      },
    ],
  },
  soql: "SELECT Id, Name FROM Account",
} satisfies CompiledQuery<{
  readonly id: string;
  readonly name: string | null;
}>;

const compiledCountQuery = {
  query: {} as CompiledQuery<number>["query"],
  soql: "SELECT COUNT() FROM Account",
} satisfies CompiledQuery<number>;

describe("createJsforceExecutor", () => {
  it("exports the executor contract and accepts the JSforce connection surface", () => {
    expectTypeOf<JsforceExecutor>().toMatchTypeOf<{
      executeAllQuery<O>(
        compiledQuery: CompiledQuery<O>,
      ): Promise<readonly O[]>;
      executeAllCountQuery(
        compiledQuery: CompiledQuery<number>,
      ): Promise<number>;
      executeCountQuery(compiledQuery: CompiledQuery<number>): Promise<number>;
    }>();
    expectTypeOf<Connection>().toMatchTypeOf<JsforceConnection>();
  });

  it("executes compiled SOQL and returns a complete single-page result", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [{ Id: "001000000000001", Name: "Acme" }],
      }),
    );
    const queryMore = vi.fn(
      async (_locator: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [],
      }),
    );

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledQuery)).resolves.toEqual([
      { Id: "001000000000001", Name: "Acme" },
    ]);
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("SELECT Id, Name FROM Account");
    expect(queryMore).not.toHaveBeenCalled();
  });

  it("maps Kysely-style field aliases from JSforce records", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [{ Id: "001000000000001", Name: "Acme" }],
      }),
    );
    const queryMore = vi.fn(
      async (_locator: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [],
      }),
    );

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledAliasQuery)).resolves.toEqual([
      { id: "001000000000001", name: "Acme" },
    ]);
    expect(query).toHaveBeenCalledWith("SELECT Id, Name FROM Account");
  });

  it("executes Salesforce QueryAll through JSforce scanAll and preserves pagination", async () => {
    const query = vi.fn(
      async (
        _soql: string,
        _options?: { readonly scanAll?: boolean },
      ): Promise<JsforceQueryResult> => ({
        done: false,
        nextRecordsUrl: "/services/data/v68.0/query/01g-query-all",
        records: [{ Id: "001000000000001", Name: "Deleted Acme" }],
      }),
    );
    const queryMore = vi.fn(
      async (_locator: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [{ Id: "001000000000002", Name: null }],
      }),
    );

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeAllQuery(compiledQuery)).resolves.toEqual([
      { Id: "001000000000001", Name: "Deleted Acme" },
      { Id: "001000000000002", Name: null },
    ]);
    expect(query).toHaveBeenCalledWith("SELECT Id, Name FROM Account", {
      scanAll: true,
    });
    expect(queryMore).toHaveBeenCalledWith(
      "/services/data/v68.0/query/01g-query-all",
    );
  });

  it("executes bare COUNT() queries through totalSize without pagination", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceCountQueryResult> => ({
        done: true,
        records: null,
        totalSize: 42,
      }),
    );
    const queryMore = vi.fn(async (_locator: string) => ({
      done: true,
      records: [],
    }));

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeCountQuery(compiledCountQuery)).resolves.toBe(
      42,
    );
    expect(query).toHaveBeenCalledWith("SELECT COUNT() FROM Account");
    expect(queryMore).not.toHaveBeenCalled();
  });

  it("executes QueryAll bare COUNT() through JSforce scanAll", async () => {
    const query = vi.fn(
      async (
        _soql: string,
        _options?: { readonly scanAll?: boolean },
      ): Promise<JsforceCountQueryResult> => ({
        done: true,
        records: null,
        totalSize: 7,
      }),
    );
    const queryMore = vi.fn(async (_locator: string) => ({
      done: true,
      records: [],
    }));

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(
      executor.executeAllCountQuery(compiledCountQuery),
    ).resolves.toBe(7);
    expect(query).toHaveBeenCalledWith("SELECT COUNT() FROM Account", {
      scanAll: true,
    });
    expect(queryMore).not.toHaveBeenCalled();
  });

  it("rejects malformed or incomplete bare COUNT() results", async () => {
    const malformedQuery = vi.fn(async (_soql: string) => ({
      done: true,
      records: [],
      totalSize: -1,
    }));
    const queryMore = vi.fn(async (_locator: string) => ({
      done: true,
      records: [],
    }));

    const malformedExecutor = createJsforceExecutor({
      query: malformedQuery,
      queryMore,
    });

    await expect(
      malformedExecutor.executeCountQuery(compiledCountQuery),
    ).rejects.toThrow("Invalid JSforce COUNT() query result:");

    const incompleteQuery = vi.fn(
      async (_soql: string): Promise<JsforceCountQueryResult> => ({
        done: false,
        records: [],
        totalSize: 42,
      }),
    );

    const incompleteExecutor = createJsforceExecutor({
      query: incompleteQuery,
      queryMore,
    });

    await expect(
      incompleteExecutor.executeCountQuery(compiledCountQuery),
    ).rejects.toThrow(
      "JSforce returned an incomplete SOQL COUNT() query result.",
    );
    expect(queryMore).not.toHaveBeenCalled();
  });

  it("follows every nextRecordsUrl until Salesforce reports done", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceQueryResult> => ({
        done: false,
        nextRecordsUrl: "/services/data/v65.0/query/01g-first",
        records: [{ Id: "001000000000001", Name: "Acme" }],
      }),
    );
    const queryMore = vi
      .fn<(locator: string) => Promise<JsforceQueryResult>>()
      .mockResolvedValueOnce({
        done: false,
        nextRecordsUrl: "/services/data/v65.0/query/01g-second",
        records: [{ Id: "001000000000002", Name: "Globex" }],
      })
      .mockResolvedValueOnce({
        done: true,
        records: [{ Id: "001000000000003", Name: null }],
      });

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledQuery)).resolves.toEqual([
      { Id: "001000000000001", Name: "Acme" },
      { Id: "001000000000002", Name: "Globex" },
      { Id: "001000000000003", Name: null },
    ]);
    expect(queryMore.mock.calls).toEqual([
      ["/services/data/v65.0/query/01g-first"],
      ["/services/data/v65.0/query/01g-second"],
    ]);
  });

  it("rejects malformed initial query results", async () => {
    const query = vi.fn(async (_soql: string) => ({
      done: "true",
      records: [],
    }));
    const queryMore = vi.fn(async (_locator: string) => ({
      done: true,
      records: [],
    }));

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledQuery)).rejects.toThrow(
      "Invalid JSforce query result:",
    );
    expect(queryMore).not.toHaveBeenCalled();
  });

  it("rejects malformed pagination results", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceQueryResult> => ({
        done: false,
        nextRecordsUrl: "/services/data/v65.0/query/01g-first",
        records: [{ Id: "001000000000001", Name: "Acme" }],
      }),
    );
    const queryMore = vi.fn(async (_locator: string) => ({
      done: true,
      records: [null],
    }));

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledQuery)).rejects.toThrow(
      "Invalid JSforce query result:",
    );
    expect(queryMore).toHaveBeenCalledOnce();
  });

  it("rejects incomplete pagination instead of returning a truncated result", async () => {
    const query = vi.fn(
      async (_soql: string): Promise<JsforceQueryResult> => ({
        done: false,
        records: [{ Id: "001000000000001", Name: "Acme" }],
      }),
    );
    const queryMore = vi.fn(
      async (_locator: string): Promise<JsforceQueryResult> => ({
        done: true,
        records: [],
      }),
    );

    const executor = createJsforceExecutor({ query, queryMore });

    await expect(executor.executeQuery(compiledQuery)).rejects.toThrow(
      "JSforce returned an incomplete query result without nextRecordsUrl.",
    );
    expect(queryMore).not.toHaveBeenCalled();
  });
});
