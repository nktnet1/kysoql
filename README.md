# kysoql

A type-safe, Kysely-inspired SOQL query builder for TypeScript.

## Workspace

- `@kysoql/core` — typed SOQL AST, query builder, compiler, executor contract, and result inference.
- `@kysoql/jsforce` — JSforce authentication/execution adapter.
- `@kysoql/codegen` — CLI for generating strongly typed Salesforce schemas from Describe metadata.
- `@kysoql/debug` — minimal TypeScript runtime playground that logs query-builder ASTs.

## Requirements

- Node.js 26 (`package.json` enforces the Node 26 range; `.node-version` pins 26.8.2 for version managers that support it).
- pnpm 12.4.1.

Activate Node 26 using whichever version manager you prefer, then install:

```bash
node --version
pnpm install
```

## Development

Run the local validation gate with one command:

```bash
pnpm validate
```

It runs TypeScript typechecking, Vitest, and all package builds in fail-fast
order. Biome is intentionally separate so formatting can be run manually when
needed:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Vitest is configured at the workspace root and discovers tests under
`packages/**/tests/**/*.test.ts`. V8 coverage output is written to `coverage/`.

To inspect the query builder at runtime without connecting to Salesforce, run:

```bash
pnpm debug
```

The debug package is written in TypeScript. It builds `@kysoql/core`, compiles the
playground to an ignored `dist/` directory, then logs the immutable AST after
`selectFrom()`, `select()`, scalar and temporal `where()` calls, additive
`orderBy()` calls, `limit()`, the compiled SOQL, and a mock executor call made
by `.execute()`.

## Current query surface

The core builder currently supports schema-checked selection, typed scalar
filtering, sortable-field-aware ordering, and validated result limits:

```ts
import { Kysoql, soqlDateTime } from "@kysoql/core";

const query = new Kysoql<SalesforceSchema>()
  .selectFrom("Account")
  .select(["Id", "Name", "AnnualRevenue", "LastModifiedDate"])
  .where("Name", "like", "Acme%")
  .where("AnnualRevenue", ">=", 100_000)
  .where(
    "LastModifiedDate",
    ">=",
    soqlDateTime("2026-01-01T00:00:00Z"),
  )
  .orderBy("AnnualRevenue", "desc")
  .orderBy("Name", "asc")
  .limit(25);

const compiled = query.compile();
// SELECT Id, Name, AnnualRevenue, LastModifiedDate FROM Account
// WHERE Name LIKE 'Acme%' AND AnnualRevenue >= 100000
// AND LastModifiedDate >= 2026-01-01T00:00:00Z
// ORDER BY AnnualRevenue DESC, Name ASC LIMIT 25
```

Selected fields, filterable fields, filter values, and operators are checked from
the generated Salesforce schema. Equality (`=`, `!=`), ordered comparisons
(`<`, `<=`, `>`, `>=`), and Kysely-style `like` are available where the field
type supports them. `.compile()` emits SOQL for the currently implemented scalar,
relationship-query, and semi/anti-join AST. `.orderBy(field,
direction?)` only accepts fields
whose generated Salesforce Describe metadata marks them `sortable: true`.
Calls are additive, and directions use Kysely-style lowercase `asc` / `desc`
while the compiler emits SOQL `ASC` / `DESC`. Omitting the direction uses
Salesforce's default ascending order. `.limit(n)` accepts non-negative safe
integers, including `0`; repeated calls replace the previous limit instead of
emitting multiple `LIMIT` clauses.

Generated parent-relationship metadata also enables typed child-to-parent dotted
paths in `.select()`, `.where()`, expression callbacks, and `.orderBy()`. The
terminal related field keeps its generated value/operator/capability checks, and
traversal is limited to Salesforce's five child-to-parent relationship levels.
Selected relationship fields infer the nested object shape returned by Salesforce,
including `null` when the generated lookup metadata is nullable. Every traversed
parent object must be present in the generated schema so its fields can be checked.

```ts
const records = await db
  .selectFrom("Kysoql_Record__c")
  .select(["Id", "Name", "Account__r.Id", "Account__r.Name"])
  .where("Account__r.Name", "like", "Kysoql Test %")
  .orderBy("Account__r.Name")
  .execute();
```

Generated child-relationship metadata enables typed parent-to-child subqueries
without accepting arbitrary subquery `FROM` strings. `.selectSubquery()` takes a
generated child relationship name and a dedicated child-query builder with the
same scalar selection/filter/order/limit rules as the root query. Child queries
can also select child-to-parent paths and nest further child subqueries through
Salesforce's supported REST/SOAP relationship-query depth.

```ts
const accountsWithContacts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .selectSubquery("Contacts", (contacts) =>
    contacts
      .select(["Id", "LastName", "CreatedBy.Alias"])
      .where("LastName", "like", "A%")
      .orderBy("LastName")
      .limit(10),
  )
  .execute();
```

Each selected child relationship retains Salesforce's nested query-result shape:
the relationship value contains `totalSize`, `done`, `records`, and an optional
`nextRecordsUrl`. Subquery `OFFSET` is intentionally not exposed because Salesforce
still documents it as a conditional pilot feature rather than a general
production child-query clause.

`IN` and `NOT IN` also accept typed semi-join/anti-join subqueries when the left
operand is a direct ID/reference field. The subquery uses a dedicated builder so
it can select exactly one compatible ID/reference field and apply scalar filters
without exposing unsupported `ORDER BY`, `LIMIT`, nested semi-joins, or arbitrary
SOQL fragments. Existing scalar-list `IN` / `NOT IN` behavior is unchanged.

```ts
const accountsWithOpenOpportunities = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Id", "in", (subquery) =>
    subquery
      .selectFrom("Opportunity")
      .select("AccountId")
      .where("StageName", "!=", "Closed Lost"),
  )
  .execute();
```

The generated reference metadata is used to ensure the selected subquery field
identifies the same Salesforce object type as the outer ID/reference operand,
including polymorphic reference targets. Semi/anti-join subqueries remain
top-level `WHERE` terms, cannot be wrapped in `OR` / `NOT`, cannot query the same
object as the outer query, and are limited to two per query.

Aggregate selection starts from the same root builder with a Kysely-style
expression callback. Row-producing aggregate functions require explicit aliases,
so result keys are stable and typed instead of depending on Salesforce `exprN`
names. Generated Describe metadata carries each field's `aggregatable` capability;
`SUM` and `AVG` additionally accept only numeric Salesforce field types.

```ts
const totals = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => [
    fn.count("Id").as("opportunityCount"),
    fn.countDistinct("AccountId").as("accountCount"),
    fn.sum("Amount").as("totalAmount"),
    fn.avg("Amount").as("averageAmount"),
    fn.min("CloseDate").as("firstCloseDate"),
    fn.max("CloseDate").as("lastCloseDate"),
  ])
  .where("IsClosed", "=", false)
  .execute();
```

Grouped aggregate queries add `.groupBy(...)` before selecting ordinary result
fields. Grouping is restricted to generated `groupable` fields, grouped fields
can be added incrementally (including supported child-to-parent references), and
ordinary selected fields must already be present in the accumulated grouping set.
Grouped queries can also order by grouped sortable fields and use `LIMIT`.

```ts
const byStage = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupBy("StageName")
  .select("StageName")
  .orderBy("StageName")
  .limit(20)
  .execute();
```

Bare `COUNT()` uses a dedicated scalar result builder because Salesforce returns
the count through the query-result count rather than an aggregate record. It
supports scalar `WHERE` filters and `LIMIT`, and the JSforce executor maps the
validated query result to a `number`.

```ts
const count = await db
  .selectFrom("Opportunity")
  .where("IsClosed", "=", false)
  .select(({ fn }) => fn.count())
  .execute();
```

Salesforce `date`, `datetime`, and `time` fields still infer as strings when
selected because that is how the generated API schema represents returned values.
Filters deliberately require `soqlDate(...)`, `soqlDateTime(...)`, or
`soqlTime(...)` instead of accepting plain strings. The factories validate the
Salesforce literal shape and the compiler emits those values unquoted, avoiding
the ambiguity between an ordinary SOQL string and a temporal literal.

Execution stays transport-neutral in core. Configure the JSforce adapter to run
compiled SOQL through an existing JSforce connection:

```ts
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";

const db = new Kysoql<SalesforceSchema>({
  executor: createJsforceExecutor(connection),
});

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .execute();
```

The JSforce executor follows Salesforce pagination until the query result reports
`done`, so `.execute()` returns all fetched pages instead of silently stopping at
the first response.

## Salesforce test org

A reproducible scratch-org fixture is included under `test/salesforce`. It
contains standard Account/Contact data plus a `Kysoql_Record__c` custom object
with representative scalar, picklist, external-ID, and relationship fields.

For a complete local setup after authenticating or creating a Dev Hub, run:

```bash
pnpm salesforce:setup
```

The setup script installs from the lockfile, uses the workspace-local Salesforce
CLI via `pnpm sf`, creates a scratch org, deploys metadata, assigns permissions,
seeds deterministic data, and verifies the fixture with a SOQL query. It refuses
to replace an existing org alias unless `--recreate` is explicitly supplied.

See [docs/salesforce-test-org.md](docs/salesforce-test-org.md) for prerequisites,
manual commands, script options, and cleanup instructions.

For future ChatGPT sessions continuing from a project bundle, read
[docs/chatgpt-handoff.md](docs/chatgpt-handoff.md) first. It records the package
boundaries, validation workflow, patch discipline, implemented surface, and next
incremental milestone.

## Design goals

- Kysely-like fluent query API.
- SOQL-native semantics instead of pretending Salesforce is SQL.
- Generated schemas for standard and custom objects/fields.
- Compile-time validation of fields, relationships, operators, grouping, sorting, and projections.
- JSforce used for Salesforce authentication and transport.
- No raw-string escape hatch in the safe API.

## Development continuity

- `docs/chatgpt-handoff.md` records the current incremental implementation state.
- `docs/research-notes.md` records external references and settled findings that are useful to future development sessions.
