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

Apex `WHERE` bind expressions use the typed `apexBind<T>(expression)` helper.
Expressions are restricted to identifiers or dotted member paths, scalar binds
preserve field-value typing, and `IN` / `NOT IN` collection binds compile without
literal-list parentheses:

```ts
import { apexAdd, apexBind } from "@kysoql/core";

const byName = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .where((eb) =>
    eb.or([
      eb("Name", "=", apexBind<string>("accountName")),
      eb("Id", "in", apexBind<readonly string[]>("accountIds")),
    ]),
  )
  .limit(apexBind<number>("rowLimit"))
  .offset(apexBind<number>("rowOffset"))
  .compile();
```

Structured Apex addition uses `apexAdd(...)` instead of admitting arithmetic as a
raw `apexBind(...)` string. It accepts matching string or numeric operands and can
compose literals with existing binds:

```ts
const composed = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexAdd("x", "xx"))
  .limit(apexAdd(apexBind<number>("baseLimit"), 1))
  .compile();
```

Salesforce's bind-left multipicklist form is exposed separately from ordinary
field filters:

```ts
const byBoundType = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where(apexBind<string>("account.Type"), "includes", [
    "Customer - Direct; Customer - Channel",
  ])
  .compile();
```

After `.apex()`, parent-to-child relationship subqueries can use the same typed
scalar, collection, and grouped `WHERE` binds:

```ts
const withContacts = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .selectSubquery("Contacts", (contacts) =>
    contacts
      .select(["Id", "LastName"])
      .where("LastName", "=", apexBind<string>("filters.lastName")),
  )
  .compile();
```

Grouped Apex filters support `and` / `or` / `not`, while `LIMIT` and `OFFSET`
accept numeric binds in addition to their validated literal forms. `apexBind<T>`
accepts a simple identifier or a dotted member path such as `filters.accountName`
and rejects calls, indexing, arithmetic text, and other raw fragments. Structured
`+` expressions are available separately through `apexAdd(...)`; method calls and
query-result expressions remain outside the safe API. Bind expressions are
intentionally unavailable on ordinary API-executable builders and as
right-hand values for Kysoql's field-left `INCLUDES` / `EXCLUDES` form. The
separate Apex-only bind-left `INCLUDES` overload keeps its right
side as literal strings. Knowledge article Apex queries reject all bind forms.
Relationship subqueries remain bind-free outside the Apex context and continue to
reject semi-joins.

Aggregate-result and bare `COUNT()` queries can also switch to `.apex()` after
their aggregate selection is built. They reuse access modes and supported bind
positions, remain compile-only, and intentionally do not expose record locking.

Pass a `QueryExecutor` to `Kysoql` when queries should execute rather than only
compile. Normal `.execute()` delegates to `QueryExecutor.executeQuery()` (or the
dedicated count hook for bare `COUNT()`). Root query builders also expose
`.executeAll()` for Salesforce QueryAll semantics; executors can opt into that
capability with `executeAllQuery()` and `executeAllCountQuery()`.
`@kysoql/jsforce` provides the first-party adapter with both execution modes.
