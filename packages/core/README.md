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

Apex-only query syntax is isolated behind an explicit compile-only context. For
example, `FOR UPDATE` is available only after switching a completed record query
into `.apex()`, so it cannot be executed accidentally through an API executor:

```ts
const lockedAccounts = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "=", "Acme")
  .apex()
  .forUpdate()
  .compile();
```

The same Apex-only surface supports explicit `.withUserMode()` and
`.withSystemMode()` clauses. Kysoql leaves the mode unspecified unless one of
those methods is called, so the generated SOQL does not assume an Apex API
version's default access behavior.

Pass a `QueryExecutor` to `Kysoql` when queries should execute rather than only
compile. Normal `.execute()` delegates to `QueryExecutor.executeQuery()` (or the
dedicated count hook for bare `COUNT()`). Root query builders also expose
`.executeAll()` for Salesforce QueryAll semantics; executors can opt into that
capability with `executeAllQuery()` and `executeAllCountQuery()`.
`@kysoql/jsforce` provides the first-party adapter with both execution modes.
