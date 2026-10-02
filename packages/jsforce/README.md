# @kysoql/jsforce

`@kysoql/jsforce` lets Kysoql execute through a JSforce connection your application already owns.

Use it when JSforce is already part of your Salesforce stack. New applications that only need SOQL execution can usually use `@kysoql/rest` instead.

## Install

```bash
pnpm add @kysoql/core @kysoql/jsforce jsforce
```

Create an executor from your existing connection and pass it to `Kysoql`:

```ts
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

const executor = createJsforceExecutor(connection);
const db = new Kysoql<SalesforceSchema>({ executor });

const account = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .limit(1)
  .executeTakeFirst();
```

The adapter follows JSforce `queryMore` pagination and supports scalar `COUNT()` queries.

## QueryAll

Kysoql's `.executeAll()` maps to JSforce's `scanAll` query option for the initial request:

```ts
const accountsIncludingDeleted = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .executeAll();
```

JSforce keeps continuation requests tied to the original QueryAll result set.

## Cancellation

Builder execution accepts an `AbortSignal`:

```ts
const controller = new AbortController();

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .execute({ signal: controller.signal });
```

Aborting stops the adapter from waiting for the current JSforce promise and prevents additional `queryMore` calls. It cannot cancel a JSforce request that is already in flight.

Authentication and connection lifecycle stay with your application.

## Documentation

- [JSforce adapter guide](https://nktnet1.github.io/kysoql/docs/jsforce)
- [Execution concepts](https://nktnet1.github.io/kysoql/docs/rest/execution)
- [API reference](https://nktnet1.github.io/kysoql/docs/jsforce/api)
