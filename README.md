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
type supports them. `.compile()` emits SOQL for the currently implemented scalar
selection/filter/order/limit AST. `.orderBy(field, direction?)` only accepts fields
whose generated Salesforce Describe metadata marks them `sortable: true`.
Calls are additive, and directions use Kysely-style lowercase `asc` / `desc`
while the compiler emits SOQL `ASC` / `DESC`. Omitting the direction uses
Salesforce's default ascending order. `.limit(n)` accepts non-negative safe
integers, including `0`; repeated calls replace the previous limit instead of
emitting multiple `LIMIT` clauses.

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
