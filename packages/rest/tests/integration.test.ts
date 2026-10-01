import assert from "node:assert/strict";
import {
  Kysoql,
  type QueryExecutor,
  type SalesforceField,
  type SalesforceObject,
} from "@kysoql/core";
import { it } from "vitest";

import { createRestExecutor } from "#src/index";
import { mockFetch, origin, page } from "./helpers.js";

type TextField<Type extends string> = SalesforceField<
  string,
  {
    readonly salesforceType: Type;
    readonly nullable: false;
    readonly filterable: true;
    readonly sortable: true;
    readonly groupable: true;
  }
>;

interface TestSchema {
  readonly Account: SalesforceObject<{
    readonly Id: TextField<"id">;
    readonly Name: TextField<"string">;
  }>;
}

it("executes typed builders, counts and QueryAll through the public REST adapter", async () => {
  const http = mockFetch(
    Response.json(page([{ Id: "1", Name: "Acme" }])),
    Response.json({ done: true, totalSize: 7, records: [] }),
    Response.json(page([{ Id: "deleted" }])),
    Response.json({ done: true, totalSize: 8, records: [] }),
  );
  const executor = createRestExecutor({
    instanceUrl: origin,
    accessToken: "token",
    fetch: http.fetch,
  });
  const contract: QueryExecutor = executor;
  const db = new Kysoql<TestSchema>({ executor: contract });
  const rows = await db
    .selectFrom("Account")
    .select(["Id", "Name"])
    .where("Name", "=", "Acme")
    .execute();
  assert.deepEqual(rows, [{ Id: "1", Name: "Acme" }]);
  assert.equal(
    await db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .execute(),
    7,
  );
  assert.deepEqual(await db.selectFrom("Account").select("Id").executeAll(), [
    { Id: "deleted" },
  ]);
  assert.equal(
    await db
      .selectFrom("Account")
      .select(({ fn }) => fn.count())
      .executeAll(),
    8,
  );
  assert.deepEqual(
    http.calls.map((call) => call.url.pathname),
    [
      "/services/data/v65.0/query",
      "/services/data/v65.0/query",
      "/services/data/v65.0/queryAll",
      "/services/data/v65.0/queryAll",
    ],
  );
  // @ts-expect-error Non-selected fields remain unavailable with the REST adapter.
  void rows[0]?.Industry;
});
