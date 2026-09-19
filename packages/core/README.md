# @kysoql/core

Type-safe, Kysely-inspired SOQL query building and compilation for TypeScript.
The core package is transport-neutral: it owns schema types, the immutable query
AST, builders, result inference, compilation, and the executor contract without
depending on JSforce.

## Install

```bash
pnpm add @kysoql/core
```

Generate a Salesforce schema with `@kysoql/codegen`, then use it as the database
type:

```ts
import { Kysoql } from "@kysoql/core";
import type { SalesforceSchema } from "./salesforce.generated";

const db = new Kysoql<SalesforceSchema>();

const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .orderBy("Name", "asc")
  .limit(25);

const compiled = query.compile();
```

Pass a `QueryExecutor` to `Kysoql` when queries should execute rather than only
compile. `@kysoql/jsforce` provides the first-party JSforce adapter.
