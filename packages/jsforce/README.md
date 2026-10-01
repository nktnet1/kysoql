# @kysoql/jsforce

JSforce execution adapter for `@kysoql/core`. It validates Salesforce query
responses at the transport boundary, follows `queryMore` pagination until the
result is complete, supports scalar SOQL `COUNT()` execution, and maps core's
QueryAll execution mode to JSforce's `scanAll` query option.

## Install

```bash
pnpm add @kysoql/core @kysoql/jsforce jsforce
```

Create an executor from a compatible JSforce connection and pass it to Kysoql:

```ts
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

const executor = createJsforceExecutor(connection);
const db = new Kysoql<SalesforceSchema>({ executor });

const controller = new AbortController();
const account = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .limit(1)
  .executeTakeFirst({ signal: controller.signal });

const accountsIncludingDeleted = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .executeAll();
```

`.executeAll()` uses `connection.query(soql, { scanAll: true })` for the initial
request. Pagination continues through `queryMore`, which Salesforce keeps tied
to the original QueryAll result set.

The adapter intentionally stays small; authentication and connection lifecycle
remain the application's responsibility. Abort signals stop waiting for the
current JSforce promise and prevent additional `queryMore` calls, but do not
cancel the underlying in-flight JSforce request.

## Documentation

Package guides live in the
[jsforce documentation](https://github.com/nktnet1/kysoql/tree/main/apps/docs/content/docs/jsforce).
The API reference is generated from this package's public `src/index.ts` entry
point with TypeDoc as part of repository documentation validation.
