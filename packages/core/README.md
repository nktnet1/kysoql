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
compile. Normal `.execute()` delegates to `QueryExecutor.executeQuery()` (or the
dedicated count hook for bare `COUNT()`). Root query builders also expose
`.executeAll()` for Salesforce QueryAll semantics; executors can opt into that
capability with `executeAllQuery()` and `executeAllCountQuery()`.
`@kysoql/jsforce` provides the first-party adapter with both execution modes.
