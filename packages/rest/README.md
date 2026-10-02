# @kysoql/rest

`@kysoql/rest` executes Kysoql queries through Salesforce REST using native `fetch`. It is the default transport for applications that do not already depend on JSforce.

It handles ordinary queries, QueryAll, scalar `COUNT()`, Salesforce query pagination, selected child relationship continuations, cancellation, and renewable access tokens.

## Install

```bash
pnpm add @kysoql/auth @kysoql/core @kysoql/rest
pnpm add -D @kysoql/codegen
```

Generate your Salesforce schema first, then create an executor:

```ts
import { SalesforceAuth } from "@kysoql/auth";
import { Kysoql } from "@kysoql/core";
import { createRestExecutor } from "@kysoql/rest";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});

let session = await auth.jwtBearer({
  username: "integration@example.com",
  privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
});

const instanceUrl = session.instanceUrl;

const executor = createRestExecutor({
  instanceUrl,
  apiVersion: "65.0",
  accessToken: async ({ refresh }) => {
    if (refresh) {
      const next = await auth.jwtBearer({
        username: "integration@example.com",
        privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
      });

      if (next.instanceUrl !== instanceUrl) {
        throw new Error("Salesforce instance changed. Recreate the REST client.");
      }

      session = next;
    }

    return session.accessToken;
  },
});

const db = new Kysoql<SalesforceSchema>({ executor });

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .execute();
```

Keep private keys and tokens outside source control.

## Pagination is automatic

`.execute()` follows Salesforce query locators until the result is complete. If you select parent-to-child relationships, the native executor also follows the continuation links for those selected child results.

```ts
const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .selectSubquery("Contacts", (contacts) =>
    contacts.select(["Id", "Name"]).orderBy("Name"),
  )
  .execute();
```

A `LIMIT` on a root query or child subquery remains that query level's record ceiling.

Use `.executeAll()` when you specifically need Salesforce QueryAll semantics for qualifying deleted or archived records. QueryAll is not a pagination setting.

## Stream larger result sets

Use the executor directly when you want to process root records as they arrive instead of collecting the whole result first:

```ts
const query = db.selectFrom("Account").select(["Id", "Name"]).compile();

for await (const account of executor.iterateQuery(query, {
  signal: AbortSignal.timeout(60_000),
})) {
  console.log(account.Id);
}
```

`queryPages()` yields complete root response pages. `iterateQuery()` yields root records. Selected child relationship results are completed before their root page is yielded.

This is still Salesforce Query REST, not Bulk API streaming.

## Resource controls

You can set request and collection limits when creating the executor:

```ts
const executor = createRestExecutor(
  {
    instanceUrl,
    accessToken,
    timeoutMs: 30_000,
  },
  {
    batchSize: 1000,
    maxPages: 500,
    maxRecords: 100_000,
  },
);
```

Budget overruns throw `SalesforceQueryLimitError` instead of returning a silently truncated result.

Per-call `signal` and `timeoutMs` options are available when you call executor methods directly. Builder execution also accepts `{ signal }`.

## Access-token renewal

`accessToken` can be a static string or a provider function. Provider tokens are cached in memory.

When Salesforce returns `401 INVALID_SESSION_ID`, the client asks the provider for a refreshed token and replays that request once. Other 401 responses, rate limits, network errors, and server errors are not automatically retried.

For OAuth flows and refresh-token storage, use [`@kysoql/auth`](https://nktnet1.github.io/kysoql/docs/auth).

## Errors

The main transport errors are:

- `SalesforceRestError` for Salesforce HTTP error responses
- `SalesforceResponseError` for malformed or unsafe response data
- `SalesforceQueryLimitError` when a configured page or record budget is exceeded
- `SalesforceOAuthError` when token acquisition fails

Native fetch and abort errors pass through so your application can handle them at its normal network boundary.

## Documentation

- [REST overview](https://nktnet1.github.io/kysoql/docs/rest)
- [Native REST execution](https://nktnet1.github.io/kysoql/docs/rest/execution)
- [Authentication and token refresh](https://nktnet1.github.io/kysoql/docs/rest/authentication)
- [Security and production use](https://nktnet1.github.io/kysoql/docs/core/reference/security)
- [API reference](https://nktnet1.github.io/kysoql/docs/rest/api)
