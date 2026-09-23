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

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .execute();

const accountsIncludingDeleted = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .executeAll();
```

`.executeAll()` uses `connection.query(soql, { scanAll: true })` for the initial
request. Pagination continues through `queryMore`, which Salesforce keeps tied
to the original QueryAll result set.

The adapter intentionally stays small; authentication and connection lifecycle
remain the application's responsibility.
