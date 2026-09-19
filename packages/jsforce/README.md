# @kysoql/jsforce

JSforce execution adapter for `@kysoql/core`. It validates Salesforce query
responses at the transport boundary, follows `queryMore` pagination until the
result is complete, and supports scalar SOQL `COUNT()` execution.

## Install

```bash
pnpm add @kysoql/core @kysoql/jsforce jsforce
```

Create an executor from a compatible JSforce connection and pass it to Kysoql:

```ts
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";
import type { SalesforceSchema } from "./salesforce.generated";

const executor = createJsforceExecutor(connection);
const db = new Kysoql<SalesforceSchema>({ executor });

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .execute();
```

The adapter intentionally stays small; authentication and connection lifecycle
remain the application's responsibility.
