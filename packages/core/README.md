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

Query builders expose Kysely-style `$call(...)` and `$if(...)` composition.
`$call` passes the current specialised builder to a callback and returns the
callback result. `$if` calls its callback only when the condition is true;
ordinary fields selected inside it become optional in the inferred result type.
Structural SOQL modes must remain unchanged across the two branches. These
helpers are available on record, aggregate, count, Apex, relationship-subquery,
and semi-join builders. Every builder that exposes `.where(...)` also exposes
`.clearWhere()` to remove all accumulated filters immutably:

```ts
const activeAccounts = db
  .selectFrom("Account")
  .select("Id")
  .$call((qb) => qb.where("Name", "like", "Acme%"))
  .$if(includeName, (qb) => qb.select("Name"));

const allAccounts = activeAccounts.clearWhere();

const soql = activeAccounts.$call((qb) => qb.compile().soql);
// Result rows: { Id: string; Name?: string | null }
```

Kysoql also exposes Kysely-style `.clearOrderBy()`, `.clearLimit()`,
`.clearOffset()`, `.clearSelect()`, and aggregate `.clearGroupBy()` where those
operations are meaningful for the specialised SOQL builder. `clearSelect()`
resets the selection accumulator so a query can be reselected with a fresh result
type. Because SOQL aggregate builders statically model grouping constraints,
`clearGroupBy()` refuses to remove grouping when grouped field selections,
`HAVING`, grouped `ORDER BY`, or grouped `LIMIT` would otherwise remain invalid.

Multi-currency `WHERE` comparisons can use structured ISO-coded literals through
`soqlCurrency(code, value)`. The ISO code must be three uppercase ASCII letters;
whether that code is active remains Salesforce-org runtime state. `IN` / `NOT IN`
lists can use either ISO-coded literals or ordinary numeric values, but Salesforce
does not allow the two forms to be mixed in one list:

```ts
import { soqlCurrency } from "@kysoql/core";

const opportunities = db
  .selectFrom("Opportunity")
  .select(["Id", "Amount"])
  .where("Amount", ">", soqlCurrency("USD", 5000))
  .where("Amount", "in", [
    soqlCurrency("USD", 5000),
    soqlCurrency("EUR", 4500),
  ]);
```

Date functions are available in ordinary `WHERE` callbacks without requiring a
grouped query. Inputs are restricted to generated filterable `date` / `datetime`
fields, `dayOnly()` and `hourInDay()` remain datetime-only, and
`convertTimezone()` can be composed around a filterable datetime field:

```ts
import { soqlDate } from "@kysoql/core";

const recent = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where((eb) =>
    eb.and([
      eb(eb.fn.calendarYear("CreatedDate"), "=", 2026),
      eb(
        eb.fn.dayOnly(eb.fn.convertTimezone("CreatedDate")),
        ">=",
        soqlDate("2026-09-01"),
      ),
    ]),
  );
```

Root queries can also add Salesforce API 48+ `WITH RecordVisibilityContext`
filtering with a structured options object. At least one of
`maxDescriptorPerRecord`, `supportsDomains`, or `supportsDelegates` is required;
repeated calls replace the previous context, and the clause cannot be combined
with another SOQL `WITH` form.

```ts
const visibleAccounts = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "=", "Acme")
  .withRecordVisibilityContext({
    maxDescriptorPerRecord: 100,
    supportsDomains: true,
  });
```

Generated Data 360 object capability metadata also gates `.setOptions(...)`. DLO
objects require a dataspace and optionally accept `honorEmptyStrings`; simple DMO
record queries accept only `honorEmptyStrings`. DLO aggregate and bare `COUNT()`
queries expose the same DLO options, and the compiler places `SET OPTIONS` last.

```ts
const data360Rows = db
  .selectFrom("ContactPoint__dll")
  .select(["Id", "EmailOptIn__c"])
  .setOptions({ dataspace: "default", honorEmptyStrings: true });
```

Managed-package dynamic SOQL uses a separate compile-only `.dynamicApex()`
context. Pass a direct `apexBind<ApexDatabaseQueryOptions>(...)` when the Apex
caller supplies a `Database.QueryOptions` value such as one built with
`withExplicitNamespace(true)`. The existing `.apex()` context remains the static
Apex surface and does not accept this bound form.

```ts
import {
  type ApexDatabaseQueryOptions,
  apexBind,
} from "@kysoql/core";

const managedDynamicQuery = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .dynamicApex()
  .setOptions(apexBind<ApexDatabaseQueryOptions>("queryOptions"))
  .compile();

// SELECT Id, Name FROM Account SET OPTIONS :queryOptions
```

Kysoql compiles the SOQL only; the Apex caller is responsible for constructing
the `Database.QueryOptions` instance and executing the dynamic query.

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

Apex record, aggregate-result, and bare `COUNT()` queries also expose
`.allRows()` for Salesforce's Apex-only `ALL ROWS` suffix, including deleted
records and archived activities. It remains distinct from API `.executeAll()`
QueryAll execution and cannot be combined with `.forUpdate()`.

Apex `WHERE` bind expressions use the typed `apexBind<T>(expression)` helper.
Expressions are restricted to identifiers or dotted member paths, scalar binds
preserve field-value typing, and `IN` / `NOT IN` collection binds compile without
literal-list parentheses:

```ts
import { apexAdd, apexBind, apexQueryField, apexSubstring } from "@kysoql/core";

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

The documented Apex string-method bind form is available as a structured helper
rather than raw method-call text:

```ts
const substring = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexSubstring("XXXX", 0, 3))
  .where(
    "Name",
    "like",
    apexAdd(apexSubstring(apexBind<string>("filters.name"), 0, 2), "%"),
  )
  .compile();
```

Salesforce's documented single-row query-result bind expression is also structured
through a builder rather than raw SOQL. `apexQueryField(query, field)` requires a
plain-mode Apex select builder and restricts `field` to its selected output keys:

```ts
const sourceAccount = db
  .selectFrom("Account")
  .select("Name")
  .apex()
  .where("Id", "=", apexBind<string>("sourceAccount.Id"));

const bySourceName = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexQueryField(sourceAccount, "Name"))
  .compile();
```

Kysoql models this as single-record field access and does not silently inject
`LIMIT 1`; Salesforce enforces the bracket query's runtime cardinality.

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
`+` expressions are available separately through `apexAdd(...)`; the documented
`String.substring(beginIndex, endIndex)` method family is available through
`apexSubstring(...)`, and single-row query-result field access is available through
`apexQueryField(...)`. Arbitrary method calls remain outside the safe API. Bind
expressions are
intentionally unavailable on ordinary API-executable builders and as
right-hand values for Kysoql's field-left `INCLUDES` / `EXCLUDES` form. The
separate Apex-only bind-left `INCLUDES` overload keeps its right
side as literal strings. Knowledge article Apex queries reject all bind forms.
Relationship subqueries remain bind-free outside the Apex context and continue to
reject semi-joins.

Grouped aggregate-result queries in the normal API context expose validated
`.limit(...)` and `.offset(...)` pagination after `GROUP BY`; `.clearOffset()`
removes the grouped offset immutably. Bare `COUNT()` remains `LIMIT`-only.

Aggregate-result and bare `COUNT()` queries can also switch to `.apex()` after
their aggregate selection is built. They reuse access modes and supported bind
positions, remain compile-only, and intentionally do not expose record locking.

Pass a `QueryExecutor` to `Kysoql` when queries should execute rather than only
compile. Normal `.execute()` delegates to `QueryExecutor.executeQuery()` (or the
dedicated count hook for bare `COUNT()`). Root query builders also expose
`.executeAll()` for Salesforce QueryAll semantics; executors can opt into that
capability with `executeAllQuery()` and `executeAllCountQuery()`.
`@kysoql/jsforce` provides the first-party adapter with both execution modes.
