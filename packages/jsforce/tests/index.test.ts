import type { CompiledQuery } from "@kysoql/core";
import type { Connection } from "jsforce";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createJsforceExecutor,
  type JsforceConnection,
  type JsforceQueryResult,
} from "#/index";

interface AccountRow {
  readonly Id: string;
  readonly Name: string | null;
}

const compiledQuery = {
  query: {} as CompiledQuery<AccountRow>["query"],
  soql: "SELECT Id, Name FROM Account",
} satisfies CompiledQuery<AccountRow>;

describe("createJsforceExecutor", () => {
  it("accepts the query/queryMore surface of a JSforce Connection", () => {
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
    const query = vi.fn(async (_soql: string): Promise<JsforceQueryResult> => ({
      done: false,
      nextRecordsUrl: "/services/data/v65.0/query/01g-first",
      records: [{ Id: "001000000000001", Name: "Acme" }],
    }));
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
