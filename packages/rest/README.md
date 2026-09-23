# @kysoql/rest

Native Salesforce REST transport for Kysoql. Uses `fetch`; JSforce is not a
runtime dependency. Supports ordinary queries, QueryAll, scalar counts, automatic
root and nested relationship pagination, async iteration, cancellation, and
access-token provider renewal.

## Install and query

```bash
pnpm add @kysoql/auth @kysoql/core @kysoql/rest
pnpm add -D @kysoql/codegen
```

Requires the workspace's Node 26 ESM environment. Generate your schema first;
see [codegen](../codegen/README.md). Local imports below are extensionless and
assume a TypeScript runner or bundler, as documented by the docs quickstart.

```ts
import { SalesforceAuth } from "@kysoql/auth";
import { Kysoql } from "@kysoql/core";
import { createRestExecutor } from "@kysoql/rest";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});
const session = await auth.jwtBearer({
  username: "integration@example.com",
  privateKey: "./salesforce-auth-key.pem",
});

const executor = createRestExecutor(
  {
    instanceUrl: session.instanceUrl,
    accessToken: session.accessToken,
    apiVersion: "65.0",
    timeoutMs: 30_000,
  },
  { batchSize: 1000, maxPages: 100, maxRecords: 100_000 },
);
const db = new Kysoql<SalesforceSchema>({ executor });
const accounts = await db.selectFrom("Account").select(["Id", "Name"]).execute();
const count = await db.selectFrom("Account").select(({ fn }) => fn.count()).execute();
```

Keep the private key outside source control. `privateKey` also accepts a raw PEM
string (trimmed automatically), file URL, or existing `CryptoKey`, so secret
manager values do not need manual PKCS#8 decoding. For long-lived services, use
an auth provider
with refresh-token storage rather than treating the JWT session as permanent.

Both `.execute()` and `.executeAll()` follow Salesforce query locators internally.
Root pages are drained automatically, and selected parent-to-child subqueries are
completed recursively at every nested level described by the compiled query. Each
root or child `LIMIT` acts as that level's record ceiling, so the executor does not
fetch a continuation after the requested limit has already been satisfied. The
latter method uses Salesforce QueryAll to include qualifying deleted/archived
records; it is not a pagination switch. Counts return `number`; fielded counts and
other aggregates return rows. No core query-building API changes are required.

## Resource controls

The example's budgets are application choices. Defaults are a 30-second timeout
per HTTP request (including token acquisition/body), `maxPages: 10_000` across
root and relationship continuation requests, and no configured root-record cap.
`batchSize` is optional and accepts integers from 200 to 2000. API version is
deliberately pinned to `65.0`, not negotiated.

```ts
const query = db.selectFrom("Account").select(["Id", "Name"]).compile();
const signal = AbortSignal.timeout(60_000); // Overall operation deadline.
for await (const account of executor.iterateQuery(query, { signal })) {
  // Process one record. Do not log sensitive fields indiscriminately.
  console.log(account.Id);
}
```

`queryPages(query, options?)` yields root envelopes without exposing Salesforce
continuation locators; `iterateQuery` yields root records. Both accept `queryAll`,
`signal`, and `timeoutMs`, and reject bare `COUNT()`. Before a root page is yielded,
its selected nested subqueries are fully materialised up to their compiled limits.
Collection and iteration throw `SalesforceQueryLimitError` on budget overflow
instead of silently truncating. Iterators can have yielded earlier pages when
later pages fail. This is not a Bulk API or byte-streaming client.

For per-call options with collection or counts, use the executor directly with
`.compile()`, e.g. `executor.executeQuery(query, { signal })`. The core builder's
`.execute()` signature is unchanged. Client-level signals apply to every request
on that client; per-call signals affect just that operation.

Parent objects, nested child envelopes, and record `attributes` are preserved.
Selected child envelopes are recursively drained by the executor; applications do
not need to inspect or follow `nextRecordsUrl`. The page budget covers root and
relationship continuation requests, while the record budget counts root records
only. Generic row types remain compile-time projections rather than runtime field
validation.

## Authentication and shared clients

`createRestClient(options)` returns a reusable GET-only `RestClient`.
`createRestExecutor(client)` and codegen's `createRestDescribeClient(client)` can
share it, including the token cache and refresh coordination. `request(path)`
returns `unknown`; prefer the executor and Describe factory for validated shapes.

`accessToken` accepts a string or an `AccessTokenProvider`:
`({ refresh: boolean }) => string | Promise<string>`. The provider is called
lazily and its token cached. Concurrent acquisition/refresh is single-flight
within one client. Only `401 INVALID_SESSION_ID` triggers a refresh and at most
one replay. Static tokens, generic 401s, rate limits, network errors, and 5xx
responses are not automatically retried. Providers must return tokens for the
same configured org; recreate the client if authentication changes the instance.

The original `authenticateClientCredentials()` and `refreshAccessToken()` helpers
remain exported for compatibility. New authentication code should use
`@kysoql/auth`, which adds the complete current Salesforce flow surface, PKCE/JWT
helpers, refresh-token rotation persistence, and memory, browser `localStorage`,
Redis, or custom token stores.

## Errors and transport boundaries

- `SalesforceRestError`: `status` and structured `errors` details. Default messages
  omit server descriptions, but details can contain sensitive query data.
- `SalesforceResponseError`: malformed JSON/envelopes, unsafe/repeated locators,
  or invalid/incomplete count results.
- `SalesforceQueryLimitError`: `limit` is `maxPages` or `maxRecords`.
- `SalesforceOAuthError`: token exchange `status` and optional error `code`.

Native network/abort failures propagate. HTTPS is required, redirects are rejected,
and query locators must be relative paths in the configured API version. An
injected `fetch` must honour `signal` and `redirect: "error"`. There is no automatic
DML, SOSL, Apex execution, Bulk API, rate limiter, or general retry policy. OAuth
application setup and credential storage remain outside this package's scope; use
`@kysoql/auth` for authentication orchestration and refresh-token persistence. Runtime options do not read CLI configuration or environment
variables automatically.

Full guides: [execution](../../apps/docs/content/docs/rest/execution.mdx),
[authentication](../../apps/docs/content/docs/rest/authentication.mdx), and
[security](../../apps/docs/content/docs/core/reference/security.mdx).
