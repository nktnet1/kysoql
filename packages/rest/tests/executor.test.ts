import assert from "node:assert/strict";
import type { CompiledQuery, ReferenceNode } from "@kysoql/core";
import { describe, it } from "vitest";

import {
  createRestExecutor,
  SalesforceQueryLimitError,
  SalesforceResponseError,
  SalesforceRestError,
} from "#/index";
import { compiled, locator, mockFetch, origin, page } from "./helpers.js";

const options = { instanceUrl: origin, accessToken: "token" };

const referenceNode = (name: string): ReferenceNode => ({
  kind: "ReferenceNode",
  name,
});

const queryLocator = (name: string): string =>
  `/services/data/v65.0/query/${name}`;

const limitedQuery = (
  limit: number,
): CompiledQuery<{ readonly Id: string }> => {
  const query = compiled<{ readonly Id: string }>(
    `SELECT Id FROM Account LIMIT ${limit}`,
  );
  return {
    ...query,
    query: {
      ...query.query,
      limit: { kind: "LimitNode", limit },
    },
  };
};

const aliasedRelationshipQuery = (): CompiledQuery<{
  readonly id: string;
  readonly ownerName: string | null;
  readonly Contacts: {
    readonly done: boolean;
    readonly totalSize: number;
    readonly records: readonly { readonly id: string }[];
  };
}> => ({
  soql: "SELECT Id, Owner.Name, (SELECT Id FROM Contacts) FROM Account",
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
          alias: "ownerName",
          node: referenceNode("Owner.Name"),
        },
      },
      {
        kind: "SelectionNode",
        selection: {
          kind: "RelationshipSubqueryNode",
          relationship: { kind: "ReferenceNode", name: "Contacts" },
          selections: [
            {
              kind: "SelectionNode",
              selection: {
                kind: "AliasNode",
                alias: "id",
                node: referenceNode("Id"),
              },
            },
          ],
        },
      },
    ],
  },
});

const deeplyNestedQuery = (): CompiledQuery<Record<string, unknown>> =>
  ({
    soql: "SELECT Id, (SELECT Id, (SELECT Id, (SELECT Id, (SELECT Id FROM WorkOrderLineItems LIMIT 2) FROM WorkOrders LIMIT 2) FROM Assets LIMIT 2) FROM Contacts LIMIT 2) FROM Account LIMIT 1",
    query: {
      kind: "SelectQueryNode",
      from: { kind: "SObjectNode", name: "Account" },
      limit: { kind: "LimitNode", limit: 1 },
      selections: [
        {
          kind: "SelectionNode",
          selection: { kind: "ReferenceNode", name: "Id" },
        },
        {
          kind: "SelectionNode",
          selection: {
            kind: "RelationshipSubqueryNode",
            relationship: { kind: "ReferenceNode", name: "Contacts" },
            limit: { kind: "LimitNode", limit: 2 },
            selections: [
              {
                kind: "SelectionNode",
                selection: { kind: "ReferenceNode", name: "Id" },
              },
              {
                kind: "SelectionNode",
                selection: {
                  kind: "RelationshipSubqueryNode",
                  relationship: { kind: "ReferenceNode", name: "Assets" },
                  limit: { kind: "LimitNode", limit: 2 },
                  selections: [
                    {
                      kind: "SelectionNode",
                      selection: { kind: "ReferenceNode", name: "Id" },
                    },
                    {
                      kind: "SelectionNode",
                      selection: {
                        kind: "RelationshipSubqueryNode",
                        relationship: {
                          kind: "ReferenceNode",
                          name: "WorkOrders",
                        },
                        limit: { kind: "LimitNode", limit: 2 },
                        selections: [
                          {
                            kind: "SelectionNode",
                            selection: { kind: "ReferenceNode", name: "Id" },
                          },
                          {
                            kind: "SelectionNode",
                            selection: {
                              kind: "RelationshipSubqueryNode",
                              relationship: {
                                kind: "ReferenceNode",
                                name: "WorkOrderLineItems",
                              },
                              limit: { kind: "LimitNode", limit: 2 },
                              selections: [
                                {
                                  kind: "SelectionNode",
                                  selection: {
                                    kind: "ReferenceNode",
                                    name: "Id",
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  }) as CompiledQuery<Record<string, unknown>>;

describe("native query executor", () => {
  it("drains ordinary query pages and does not append SOQL to continuation URLs", async () => {
    const http = mockFetch(
      Response.json({
        ...page([{ Id: "1" }, { Id: "2" }], locator),
        totalSize: 3,
      }),
      Response.json({ ...page([{ Id: "3" }]), totalSize: 3 }),
    );
    const executor = createRestExecutor({ ...options, fetch: http.fetch });
    const soql = "SELECT Id FROM Account WHERE Name = 'A&B + %'";
    assert.deepEqual(await executor.executeQuery(compiled(soql)), [
      { Id: "1" },
      { Id: "2" },
      { Id: "3" },
    ]);
    assert.equal(http.calls[0]?.url.searchParams.get("q"), soql);
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v65.0/query");
    assert.equal(http.calls[1]?.url.pathname, locator);
    assert.equal(http.calls[1]?.url.search, "");
  });

  it("maps Kysely-style field aliases for root and relationship records", async () => {
    const http = mockFetch(
      Response.json(
        page([
          {
            Id: "001",
            Owner: { Name: "Ada" },
            Contacts: {
              done: true,
              totalSize: 1,
              records: [{ Id: "003" }],
            },
          },
        ]),
      ),
    );
    const executor = createRestExecutor({ ...options, fetch: http.fetch });

    const [record] = await executor.executeQuery(aliasedRelationshipQuery());
    assert.equal(record?.id, "001");
    assert.equal(record?.ownerName, "Ada");
    assert.equal(record?.Contacts.records[0]?.id, "003");
    assert.equal(record === undefined ? true : "Id" in record, false);
    assert.equal(record === undefined ? true : "Owner" in record, false);
    assert.equal(
      record?.Contacts.records[0] === undefined
        ? true
        : "Id" in record.Contacts.records[0],
      false,
    );
    assert.equal(
      http.calls[0]?.url.searchParams.get("q"),
      "SELECT Id, Owner.Name, (SELECT Id FROM Contacts) FROM Account",
    );
  });

  it("stops following root continuations once the compiled LIMIT is satisfied", async () => {
    const second = queryLocator("root-second");
    const unnecessary = queryLocator("root-unnecessary");
    const http = mockFetch(
      Response.json({
        ...page([{ Id: "1" }, { Id: "2" }], second),
        totalSize: 4,
      }),
      Response.json({
        ...page([{ Id: "3" }, { Id: "4" }], unnecessary),
        totalSize: 4,
      }),
    );
    const executor = createRestExecutor({ ...options, fetch: http.fetch });

    assert.deepEqual(await executor.executeQuery(limitedQuery(3)), [
      { Id: "1" },
      { Id: "2" },
      { Id: "3" },
    ]);
    assert.equal(http.calls.length, 2);
    assert.equal(http.calls[1]?.url.pathname, second);
  });

  it("keeps continuation locators internal when streaming root pages", async () => {
    const second = queryLocator("stream-second");
    const http = mockFetch(
      Response.json(page([{ Id: "1" }], second)),
      Response.json(page([{ Id: "2" }])),
    );
    const pages = createRestExecutor({
      ...options,
      fetch: http.fetch,
    }).queryPages(compiled());

    const first = await pages.next();
    assert.equal(first.done, false);
    assert.equal(first.value?.done, false);
    assert.equal(
      first.value === undefined ? true : "nextRecordsUrl" in first.value,
      false,
    );
    assert.equal((await pages.next()).value?.done, true);
  });

  it("recursively drains four levels of child continuations and honours every child LIMIT", async () => {
    const contacts = queryLocator("contacts-2");
    const contactsExtra = queryLocator("contacts-extra");
    const assets = queryLocator("assets-2");
    const assetsExtra = queryLocator("assets-extra");
    const workOrders = queryLocator("work-orders-2");
    const workOrdersExtra = queryLocator("work-orders-extra");
    const lineItems = queryLocator("line-items-2");
    const lineItemsExtra = queryLocator("line-items-extra");
    const nested = (
      records: readonly Record<string, unknown>[],
      next?: string,
    ) => ({
      totalSize: 3,
      done: next === undefined,
      records,
      ...(next === undefined ? {} : { nextRecordsUrl: next }),
    });

    const http = mockFetch(
      Response.json(
        page([
          {
            Id: "A1",
            Contacts: nested(
              [
                {
                  Id: "C1",
                  Assets: nested(
                    [
                      {
                        Id: "AS1",
                        WorkOrders: nested(
                          [
                            {
                              Id: "W1",
                              WorkOrderLineItems: nested(
                                [{ Id: "L1" }],
                                lineItems,
                              ),
                            },
                          ],
                          workOrders,
                        ),
                      },
                    ],
                    assets,
                  ),
                },
              ],
              contacts,
            ),
          },
        ]),
      ),
      Response.json(nested([{ Id: "L2" }, { Id: "L3" }], lineItemsExtra)),
      Response.json(
        nested(
          [
            {
              Id: "W2",
              WorkOrderLineItems: nested([{ Id: "L4" }]),
            },
            {
              Id: "W3",
              WorkOrderLineItems: { malformed: true },
            },
          ],
          workOrdersExtra,
        ),
      ),
      Response.json(
        nested(
          [
            {
              Id: "AS2",
              WorkOrders: nested([
                {
                  Id: "W4",
                  WorkOrderLineItems: nested([{ Id: "L5" }]),
                },
              ]),
            },
            { Id: "AS3", WorkOrders: { malformed: true } },
          ],
          assetsExtra,
        ),
      ),
      Response.json(
        nested(
          [
            {
              Id: "C2",
              Assets: nested([
                {
                  Id: "AS4",
                  WorkOrders: nested([
                    {
                      Id: "W5",
                      WorkOrderLineItems: nested([{ Id: "L6" }]),
                    },
                  ]),
                },
              ]),
            },
            { Id: "C3", Assets: { malformed: true } },
          ],
          contactsExtra,
        ),
      ),
    );

    const [account] = await createRestExecutor({
      ...options,
      fetch: http.fetch,
    }).executeQuery(deeplyNestedQuery());

    assert.deepEqual(account, {
      Id: "A1",
      Contacts: {
        totalSize: 3,
        done: true,
        records: [
          {
            Id: "C1",
            Assets: {
              totalSize: 3,
              done: true,
              records: [
                {
                  Id: "AS1",
                  WorkOrders: {
                    totalSize: 3,
                    done: true,
                    records: [
                      {
                        Id: "W1",
                        WorkOrderLineItems: {
                          totalSize: 3,
                          done: true,
                          records: [{ Id: "L1" }, { Id: "L2" }],
                        },
                      },
                      {
                        Id: "W2",
                        WorkOrderLineItems: {
                          totalSize: 3,
                          done: true,
                          records: [{ Id: "L4" }],
                        },
                      },
                    ],
                  },
                },
                {
                  Id: "AS2",
                  WorkOrders: {
                    totalSize: 3,
                    done: true,
                    records: [
                      {
                        Id: "W4",
                        WorkOrderLineItems: {
                          totalSize: 3,
                          done: true,
                          records: [{ Id: "L5" }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            Id: "C2",
            Assets: {
              totalSize: 3,
              done: true,
              records: [
                {
                  Id: "AS4",
                  WorkOrders: {
                    totalSize: 3,
                    done: true,
                    records: [
                      {
                        Id: "W5",
                        WorkOrderLineItems: {
                          totalSize: 3,
                          done: true,
                          records: [{ Id: "L6" }],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
    assert.deepEqual(
      http.calls.map((call) => call.url.pathname),
      ["/services/data/v65.0/query", lineItems, workOrders, assets, contacts],
    );
  });

  it("uses QueryAll for the first request and follows its /query/ locator unchanged", async () => {
    const http = mockFetch(
      Response.json(page([{ Id: "deleted" }], locator)),
      Response.json(page([{ Id: "archived" }])),
    );
    const executor = createRestExecutor({ ...options, fetch: http.fetch });
    assert.equal((await executor.executeAllQuery(compiled())).length, 2);
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v65.0/queryAll");
    assert.equal(http.calls[1]?.url.pathname, locator);
  });

  it("returns an empty array when there are no matches", async () => {
    const http = mockFetch(Response.json(page()));
    assert.deepEqual(
      await createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
        compiled(),
      ),
      [],
    );
  });

  it("preserves parent objects, nulls, attributes and child envelopes without guessing field types", async () => {
    const row = {
      Id: "1",
      attributes: { type: "Account" },
      Owner: { Name: "Jane" },
      Parent: null,
      Contacts: {
        totalSize: 5,
        done: false,
        records: [{ LastName: "Example" }],
        nextRecordsUrl: locator,
      },
    };
    const http = mockFetch(Response.json(page([row])));
    assert.deepEqual(
      await createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
        compiled<typeof row>(),
      ),
      [row],
    );
    assert.equal(http.calls.length, 1);
  });

  for (const records of [undefined, null, []]) {
    it(`returns totalSize for a bare COUNT() with records=${JSON.stringify(records)}`, async () => {
      const http = mockFetch(
        Response.json({
          done: true,
          totalSize: 42,
          ...(records === undefined ? {} : { records }),
        }),
      );
      assert.equal(
        await createRestExecutor({
          ...options,
          fetch: http.fetch,
        }).executeCountQuery(compiled<number>("SELECT COUNT() FROM Account")),
        42,
      );
    });
  }

  it("handles QueryAll counts and zero counts", async () => {
    const http = mockFetch(
      Response.json({ done: true, totalSize: 0, records: [] }),
    );
    assert.equal(
      await createRestExecutor({
        ...options,
        fetch: http.fetch,
      }).executeAllCountQuery(compiled<number>("SELECT COUNT() FROM Account")),
      0,
    );
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v65.0/queryAll");
  });

  it("keeps COUNT(field), grouped aggregates, and aliases as row results", async () => {
    const rows = [
      {
        attributes: { type: "AggregateResult" },
        Industry: "Technology",
        count: 7,
      },
    ];
    const http = mockFetch(Response.json(page(rows)));
    assert.deepEqual(
      await createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
        compiled<(typeof rows)[number]>(
          "SELECT Industry, COUNT(Id) count FROM Account GROUP BY Industry",
        ),
      ),
      rows,
    );
  });

  for (const body of [
    null,
    [],
    {},
    { done: true, records: [] },
    { done: true, totalSize: -1, records: [] },
    { done: true, totalSize: 1.5, records: [] },
    { done: true, totalSize: Number.MAX_SAFE_INTEGER + 1, records: [] },
    { done: "true", totalSize: 0, records: [] },
    { done: true, totalSize: 0, records: null },
    { done: true, totalSize: 1, records: [null] },
    { done: true, totalSize: 1, records: ["row"] },
    { done: false, totalSize: 1, records: [] },
    { done: false, totalSize: 1, records: [], nextRecordsUrl: "" },
    { done: true, totalSize: 1, records: [], nextRecordsUrl: 12 },
  ]) {
    it(`rejects an invalid query envelope ${JSON.stringify(body)}`, async () => {
      const http = mockFetch(Response.json(body));
      await assert.rejects(
        createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
          compiled(),
        ),
        SalesforceResponseError,
      );
    });
  }

  for (const body of [
    { done: false, totalSize: 4, records: [], nextRecordsUrl: locator },
    { done: true, totalSize: -1 },
    { done: true, totalSize: 0.5 },
    { done: true, totalSize: "42" },
    { done: true, totalSize: 1, records: [{ expr0: 42 }] },
  ]) {
    it(`rejects an invalid scalar count ${JSON.stringify(body)}`, async () => {
      const http = mockFetch(Response.json(body));
      await assert.rejects(
        createRestExecutor({ ...options, fetch: http.fetch }).executeCountQuery(
          compiled<number>(),
        ),
        SalesforceResponseError,
      );
      assert.equal(http.calls.length, 1);
    });
  }

  for (const next of [
    "https://evil.invalid/query/x",
    "//evil.invalid/query/x",
    "https://example.my.salesforce.com/services/data/v65.0/query/x",
    "/services/data/v65.0/query/../sobjects",
    "/services/data/v65.0/query/%2e%2e",
    "/services/data/v65.0/query/x?q=other",
    "/services/data/v65.0/query/x#fragment",
    "/services/data/v65.0/query/x\\y",
    "/services/data/v64.0/query/x",
    "/services/data/v65.0/sobjects/Account",
    "/services/data/v65.0/query/",
  ]) {
    it(`rejects an unsafe locator before following it: ${next}`, async () => {
      const http = mockFetch(Response.json(page([], next)));
      await assert.rejects(
        createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
          compiled(),
        ),
        SalesforceResponseError,
      );
      assert.equal(http.calls.length, 1);
    });
  }

  it("rejects repeated cursors without returning a misleading successful partial array", async () => {
    const http = mockFetch(
      Response.json(page([{ Id: "1" }], locator)),
      Response.json(page([{ Id: "2" }], locator)),
    );
    await assert.rejects(
      createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
        compiled(),
      ),
      /repeated query locator/,
    );
    assert.equal(http.calls.length, 2);
  });

  it("stops at maxPages rather than silently truncating", async () => {
    const http = mockFetch(Response.json(page([{ Id: "1" }], locator)));
    const executor = createRestExecutor(
      { ...options, fetch: http.fetch },
      { maxPages: 1 },
    );
    await assert.rejects(
      executor.executeQuery(compiled()),
      (error: unknown) => {
        assert.ok(error instanceof SalesforceQueryLimitError);
        assert.equal(error.limit, "maxPages");
        return true;
      },
    );
    assert.equal(http.calls.length, 1);
  });

  it("enforces the accumulated record budget, not Salesforce's reported total", async () => {
    const http = mockFetch(
      Response.json(page([{ Id: "1" }], locator)),
      Response.json(page([{ Id: "2" }, { Id: "3" }])),
    );
    const executor = createRestExecutor(
      { ...options, fetch: http.fetch },
      { maxRecords: 2 },
    );
    await assert.rejects(
      executor.executeQuery(compiled()),
      (error: unknown) => {
        assert.ok(error instanceof SalesforceQueryLimitError);
        assert.equal(error.limit, "maxRecords");
        return true;
      },
    );
  });

  it("does not trust totalSize as a guarantee that all rows have arrived", async () => {
    const http = mockFetch(
      Response.json({ ...page([{ Id: "1" }], locator), totalSize: 1 }),
      Response.json(page([{ Id: "2" }])),
    );
    assert.equal(
      (
        await createRestExecutor({
          ...options,
          fetch: http.fetch,
        }).executeQuery(compiled())
      ).length,
      2,
    );
  });

  it("propagates a later-page error instead of returning earlier records as success", async () => {
    const http = mockFetch(
      Response.json(page([{ Id: "1" }], locator)),
      Response.json(
        [{ errorCode: "INVALID_QUERY_LOCATOR", message: "expired" }],
        { status: 400 },
      ),
    );
    await assert.rejects(
      createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
        compiled(),
      ),
      SalesforceRestError,
    );
  });

  it("streams pages lazily and performs no further HTTP work after early termination", async () => {
    const http = mockFetch(
      Response.json(page([{ Id: "1" }, { Id: "2" }], locator)),
    );
    const iterator = createRestExecutor({
      ...options,
      fetch: http.fetch,
    }).iterateQuery(compiled());
    assert.equal(http.calls.length, 0);
    for await (const record of iterator) {
      assert.equal(record.Id, "1");
      break;
    }
    assert.equal(http.calls.length, 1);
  });

  it("supports streaming QueryAll with explicit mode selection", async () => {
    const http = mockFetch(Response.json(page([{ Id: "1" }])));
    const executor = createRestExecutor({ ...options, fetch: http.fetch });
    for await (const result of executor.queryPages(compiled(), {
      queryAll: true,
    })) {
      assert.equal(result.totalSize, 1);
      assert.deepEqual(result.records, [{ Id: "1" }]);
    }
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v65.0/queryAll");
  });

  it("supports cancellation between pages without fetching another page", async () => {
    const http = mockFetch(Response.json(page([{ Id: "1" }], locator)));
    const controller = new AbortController();
    const reason = new Error("stop");
    const iterator = createRestExecutor({
      ...options,
      fetch: http.fetch,
    }).queryPages(compiled(), { signal: controller.signal });
    await iterator.next();
    controller.abort(reason);
    await assert.rejects(iterator.next(), (cause: unknown) => cause === reason);
    assert.equal(http.calls.length, 1);
  });

  it("honours cancellation even when streaming records buffered in one page", async () => {
    const http = mockFetch(Response.json(page([{ Id: "1" }, { Id: "2" }])));
    const controller = new AbortController();
    const iterator = createRestExecutor({
      ...options,
      fetch: http.fetch,
    }).iterateQuery(compiled(), { signal: controller.signal });
    await iterator.next();
    controller.abort();
    await assert.rejects(iterator.next(), { name: "AbortError" });
  });

  it("does not let extra structural options change executeQuery to QueryAll", async () => {
    const http = mockFetch(Response.json(page()));
    const request = { timeoutMs: 1000, queryAll: true };
    await createRestExecutor({ ...options, fetch: http.fetch }).executeQuery(
      compiled(),
      request,
    );
    assert.equal(http.calls[0]?.url.pathname, "/services/data/v65.0/query");
  });

  for (const limits of [
    { maxPages: 0 },
    { maxRecords: 0 },
    { maxPages: 1.5 },
    { maxRecords: -1 },
    { maxPages: Number.POSITIVE_INFINITY },
  ]) {
    it(`rejects invalid budgets ${JSON.stringify(limits)}`, () => {
      assert.throws(
        () => createRestExecutor(options, limits),
        /positive safe integer/,
      );
    });
  }
});

describe("bare-count routing", () => {
  const count = {
    ...compiled<number>("SELECT COUNT() FROM Account"),
    query: {
      kind: "SelectQueryNode" as const,
      from: { kind: "SObjectNode" as const, name: "Account" },
      selections: [
        {
          kind: "SelectionNode" as const,
          selection: {
            kind: "AggregateFunctionNode" as const,
            function: "count" as const,
          },
        },
      ],
    },
  };

  for (const mode of [
    "executeQuery",
    "executeAllQuery",
    "queryPages",
    "iterateQuery",
  ] as const) {
    it(`rejects bare COUNT() through ${mode} before a request`, async () => {
      const http = mockFetch();
      const executor = createRestExecutor({ ...options, fetch: http.fetch });
      const operation =
        mode === "queryPages" || mode === "iterateQuery"
          ? executor[mode](count).next()
          : executor[mode](count);
      await assert.rejects(operation, /executeCountQuery/);
      assert.equal(http.calls.length, 0);
    });
  }
});
