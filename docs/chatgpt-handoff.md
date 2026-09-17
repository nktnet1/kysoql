# ChatGPT continuation handoff

This document is the continuity point for future ChatGPT sessions working on
kysoql from a Git/project bundle. Read this file before making architectural
changes or generating another patch.

## Project intent

kysoql is a TypeScript, Kysely-inspired query builder for Salesforce SOQL. The
safe API should remain SOQL-native and fully type-driven from generated
Salesforce Describe metadata.

The package boundaries are intentional:

- `@kysoql/core` owns schema types, the immutable query AST, query builders,
  type inference, and eventually SOQL compilation. It must stay transport- and
  JSforce-independent.
- `@kysoql/codegen` uses Salesforce Describe metadata to generate the schema
  consumed by core. It supports standard and custom objects.
- `@kysoql/jsforce` is the JSforce transport/execution adapter. JSforce also
  remains the authentication/API client used by the project tooling.
- `@kysoql/debug` is a deliberately minimal runtime playground. It must stay
  dependency-light and log existing builder/AST behavior without introducing
  production query semantics.

Follow Kysely's public API and internal architecture closely where the model
maps cleanly to SOQL. Do not copy SQL-only semantics such as arbitrary joins
into the SOQL API.

## Current development state

Through `v1.0.21`, the project has:

- a Node 26 / pnpm / Turborepo / Biome / Vitest workspace;
- a reproducible Salesforce scratch-org fixture and deterministic seed data;
- `pnpm sf` as the repository-local Salesforce CLI convention;
- safe scratch-org setup via `pnpm salesforce:setup`;
- schema generation via `pnpm salesforce:schema -- ...` using JSforce and the
  authenticated Salesforce CLI session;
- generated Salesforce field, capability, picklist, parent relationship, and
  child relationship metadata;
- Kysely-style `Kysoql<DB> -> QueryCreator<DB> -> SelectQueryBuilder<DB, TB, O>`;
- immutable `SelectQueryNode`, `SObjectNode`, `SelectionNode`, and
  `ReferenceNode` AST nodes;
- typed `selectFrom()` and additive `.select()` overloads;
- typed `.where(field, operator, value)` for equality, ordered comparisons (`<`, `<=`, `>`, `>=`), and Kysely-style `like`;
- field-type-aware operator constraints: `LIKE` is limited to Salesforce string-like fields, ordered comparisons exclude unsupported field types, and only equality accepts nullable `null` values;
- explicit `soqlDate(...)`, `soqlDateTime(...)`, and `soqlTime(...)` filter literals that validate Salesforce temporal formats and compile unquoted; generated date/dateTime/time result values intentionally remain strings;
- immutable `WhereNode`, `BinaryOperationNode`, `OperatorNode`, `ValueNode`, and `AndNode` filtering AST;
- typed `.orderBy(field, direction?)` constrained by generated `sortable: true`
  metadata, with Kysely-style lowercase `asc` / `desc` directions;
- typed `.limit(number)` backed by an immutable `LimitNode`; limits must be
  non-negative safe integers, `0` is accepted, and repeated calls replace the
  previous limit;
- immutable `OrderByNode` / `OrderByItemNode` ordering AST, with repeated
  `.orderBy()` calls accumulating in call order and compiler output using SOQL
  `ASC` / `DESC`;
- Kysely-style `CompiledQuery<O>` / `QueryCompiler` abstractions and `.compile()` for selected scalar fields, chained `AND` filters, scalar string/number/boolean/null literals, and the currently supported comparison operators;
- `docs/research-notes.md` records external references and settled findings that would otherwise be repeatedly researched in future sessions;
- a transport-neutral `QueryExecutor` contract plus `SelectQueryBuilder.execute()` with selected-output typing preserved;
- `@kysoql/jsforce` adapts a JSforce connection to that executor, compiles no SOQL itself, and follows `nextRecordsUrl` through all result pages instead of silently truncating;
- SOQL-safe escaping for quoted strings, including preserved `\%` / `\_` LIKE wildcard escapes;
- compile-time rejection of unknown/non-filterable fields, unsupported operators, and mismatched filter values;
- package tests live under `packages/*/tests/**`; package-level Vitest scripts use
  `--dir tests` so stale generated `dist/**/*.test.js` files are never discovered;
- `pnpm validate` as the type/test/build validation gate; Biome stays manual;
- `pnpm debug` as a no-Salesforce TypeScript runtime playground that logs the AST produced
  by `selectFrom()`, `select()`, chained `where()` calls, additive `orderBy()`
  calls, and `limit()`, then logs compile and mock execution behavior; source
  files remain `.ts` and generated JavaScript lives only in ignored `dist/`
  output.

`v1.0.20` is a test-only fix: the compile-time LIMIT signature assertion was
changed to a type-only Vitest assertion so invalid string input is not deliberately
executed at runtime. `v1.0.21` is documentation-only and introduces no runtime or
type-system behavior.

There is intentionally no `OFFSET`, null-order modifier, grouped boolean-expression
builder, `IN` / `NOT IN`, multi-select-picklist `INCLUDES` / `EXCLUDES`, relative
Salesforce date-literal support such as `TODAY` / `LAST_N_DAYS:n`, relationship
traversal/subqueries, aggregate query surface, `TYPEOF`, or broader specialist SOQL
clause support in core yet. The complete planned surface is recorded below under
"Remaining SOQL roadmap".

## Validation

After every change, the preferred local command is:

```bash
pnpm validate
```

It runs, in fail-fast order:

1. TypeScript typechecking;
2. Vitest;
3. all package builds.

Formatting and Biome checks are intentionally outside this gate. Run them
manually when desired:

```bash
pnpm check
```

Salesforce fixture setup and live schema generation are separate because they
require an authenticated org:

```bash
pnpm salesforce:setup
pnpm salesforce:schema -- \
  --object Account \
  --object Kysoql_Record__c \
  --output test/salesforce/salesforce.generated.ts
```

Never commit or print Salesforce access tokens.

## Patch discipline

Changes are delivered as incremental patches from the immediately preceding
state. Never rewrite an older patch after it has been handed off.

Patch artifact versions are strictly sequential. **Every delivered patch consumes
the next `v1.0.x` number exactly once, regardless of whether it is feature work,
a refactor, tests only, documentation, or configuration. Never reuse a version
number for a follow-up patch.** The patch sequence version is independent of the
workspace/package manifests, which remain `0.0.0` until package publishing is
introduced.

A few support patches immediately after `v1.0.18` were historically handed off
with `v1.0.18-*` filenames before this rule was made explicit. Do not renumber or
rewrite those old artifacts retroactively. Starting with this state, the sequence
is authoritative again:

```text
v1.0.0 -> v1.0.1 -> ... -> v1.0.19 -> v1.0.20 -> v1.0.21
```

`v1.0.20` was the LIMIT compile-time test fix. `v1.0.21` is this documentation-only
patch. The next delivered patch must therefore be `v1.0.22-*`, generated against
the complete state after `v1.0.21` is applied. If a test/refactor/config/docs patch
is delivered before a planned feature, that patch consumes the version and every
later milestone shifts forward by one. Before handing off any patch, verify at
minimum (substituting the actual next version):

```bash
git apply --check v1.0.22-kysoql.patch
git diff --check
```

When a fresh project bundle is supplied, inspect the actual bundle first. The
bundle is authoritative; this document explains intent and continuation state,
but should not override newer code in the bundle.

For a ChatGPT handoff, commit the current repository state before creating the
bundle, because `git bundle` contains Git history and does not include uncommitted
working-tree changes:

```bash
git status
git bundle create project.bundle --all
```

Give the new `project.bundle` to the next session and explicitly tell it to read
this document before continuing.

## Runtime validation convention

Prefer Valibot for external/runtime data validation wherever it maps cleanly to a
schema. Use the namespace import consistently:

```ts
import * as v from "valibot";
```

For fallible external inputs, prefer `v.safeParse(...)` and report validation
failures with `v.summarize(result.issues)` where a human-readable message is
needed. Good targets include CLI arguments/environment variables, Salesforce
Describe/query response shapes, transport pagination payloads, and primitive
builder inputs such as LIMIT/OFFSET or explicit temporal literals.

Do not force Valibot onto internal compiler/AST invariants whose failure means a
programming bug rather than malformed external data. Unsupported operation-node
branches and impossible internal states can remain ordinary invariant errors.

The requested Valibot cleanup has not been applied yet. If it is the next patch,
it consumes `v1.0.22`; the first new SOQL feature then moves to `v1.0.23`.

## Remaining SOQL roadmap

The practical target is broad REST/SOAP SOQL coverage with generated-schema typing.
Apex-only execution semantics and object-specific specialist syntax should be
separate extensions rather than forcing them into the transport-neutral safe API.

Recommended order, with each item kept to its own incremental patch or tightly
related patch series:

1. **Validation cleanup (non-SOQL prerequisite).** Convert appropriate runtime
   boundaries to Valibot as described above. This is the currently pending
   maintenance task and should be `v1.0.22` if done next.
2. **`OFFSET`.** Add an immutable offset node, `.offset(number)`, compiler support,
   replacement semantics on repeated calls, and Salesforce's documented `0..2000`
   bound. If the Valibot patch lands first, this becomes `v1.0.23`.
3. **`ORDER BY ... NULLS FIRST|LAST`.** Extend the existing sortable-field ordering
   model with explicit null placement while preserving the current additive order
   list and lowercase builder conventions.
4. **Full boolean condition expressions.** Add grouped predicates plus `OR` and
   logical `NOT` without weakening the existing field-aware operator types. Repeated
   top-level `.where()` can remain AND-combining sugar over the richer expression
   AST.
5. **Remaining comparison operators.** Add typed `IN` / `NOT IN`, then
   multi-select-picklist-specific `INCLUDES` / `EXCLUDES`. Keep operator availability
   driven by generated Salesforce field metadata/types.
6. **Relative date literals.** Add explicit typed values for Salesforce literals
   such as `TODAY`, `YESTERDAY`, `THIS_WEEK`, `LAST_N_DAYS:n`, `NEXT_N_MONTHS:n`,
   and fiscal-period variants. Do not represent them as ordinary strings or smuggle
   them through the absolute `soqlDate*` factories.
7. **Relationship paths and relationship queries.** Support child-to-parent dotted
   field paths in selection/filtering/ordering, then parent-to-child subqueries.
   Use generated parent/child relationship metadata; never add arbitrary SQL joins.
   Relationship query output typing will require nested result-shape inference.
8. **Semi-joins and anti-joins.** Extend `IN` / `NOT IN` with typed subquery operands
   and enforce Salesforce's ID/reference-field and nesting restrictions in the safe
   API where practical.
9. **Aggregate queries.** Add `COUNT()`, `COUNT(field)`, `COUNT_DISTINCT`, `SUM`,
   `AVG`, `MIN`, and `MAX`, then aliases, `GROUP BY`, `HAVING`, `ROLLUP`, `CUBE`,
   and `GROUPING()`. Generated `groupable` metadata should constrain grouping.
   Aggregate result typing is a major architectural milestone because output rows
   are no longer the ordinary selected SObject shape.
10. **Broader SELECT expressions/functions.** Add typed support for `FIELDS(...)`,
    `toLabel()`, `FORMAT()`, `convertCurrency()`, date/calendar functions,
    `convertTimezone()`, and geolocation expressions such as `DISTANCE()` /
    `GEOLOCATION()` where their Salesforce restrictions can be modeled safely.
11. **Polymorphic references / `TYPEOF`.** Model `TYPEOF ... WHEN ... THEN ... ELSE
    ... END` with dedicated AST nodes and discriminated output typing; do not flatten
    it into ordinary field selection.
12. **Specialist top-level clauses.** Add `USING SCOPE`, `WITH DATA CATEGORY`, and
    other REST/SOAP-relevant `WITH`/scope clauses as separate narrowly typed
    features. Object-specific forms such as `FOR VIEW`, `FOR REFERENCE`, and
    Knowledge tracking/view-stat updates should come late.
13. **Execution-context-specific syntax.** Re-evaluate Apex-oriented features such
    as `FOR UPDATE`, `WITH USER_MODE`, `WITH SYSTEM_MODE`, bind expressions, and
    related execution semantics separately. Core currently executes through a
    transport-neutral compiler plus JSforce/REST adapter, so syntax whose semantics
    only exist in Apex should not be added merely for grammar completeness.

The two largest future architecture changes are relationship queries and aggregate
queries. Both materially change the AST and inferred output type, so the earlier
boolean/operator/date work should land first to avoid redesigning those systems
inside nested queries later.

## Next incremental milestone

Keep the next patch small. The currently requested maintenance slice is the
Valibot validation cleanup described above. If it is delivered next, it must be
`v1.0.22` and should avoid adding new SOQL syntax at the same time.

After that, the first planned feature slice is typed `OFFSET` support (`v1.0.23`
if Valibot consumes `v1.0.22`):

- add an offset AST node and compiler support without touching execution;
- expose `.offset(...)` on `SelectQueryBuilder` with a safe numeric surface;
- honor Salesforce's documented `0..2000` offset range;
- a later `.offset(...)` call should deterministically replace the earlier offset
  rather than append a second SOQL `OFFSET` clause;
- add AST/compiler/runtime-validation tests plus a minimal debug example;
- do not mix in `NULLS FIRST` / `NULLS LAST`, OR-expression syntax, relative date
  literals, or new comparison operators in the same patch.

Preserve `v1.0.19` LIMIT behavior: limits are non-negative safe integers with no
invented general SOQL upper cap, `LIMIT 0` is accepted, repeated `.limit()` calls
replace, and compilation places `LIMIT` after `ORDER BY`.

The temporal literal layer added in `v1.0.17` should remain explicit. Generated
Salesforce temporal field values continue to be strings on query results, while
filter inputs use the branded factories so the compiler can distinguish quoted
strings from unquoted SOQL date/dateTime/time values. Relative date literals are
a separate future feature and should not be smuggled through these factories.

In particular, preserve these design choices:

- immutable builders and AST cloning;
- repeated `.where()` calls combine through the Kysely-style `WhereNode` /
  `AndNode` structure;
- filtering must honor generated `filterable` metadata;
- ordering must honor generated `sortable` metadata;
- repeated `.orderBy()` calls remain additive and preserve call order;
- explicit ordering directions use lowercase `asc` / `desc` in the builder and
  compile to uppercase SOQL `ASC` / `DESC`;
- operator availability must remain Salesforce-field-type-aware;
- the public API uses Kysely-style lowercase `like`; the compiler emits SOQL
  `LIKE`;
- output type accumulation using Kysely's `O & Selection<...>` pattern;
- `.compile()` must preserve the selected output type through the type-only
  `CompiledQuery<O>` carrier;
- temporal filter literals stay explicit and type-matched to `date`, `datetime`,
  and `time` fields;
- execution stays transport-neutral in core;
- JSforce execution must not silently truncate paginated query results;
- no raw SOQL escape hatch in the safe API;
- no arbitrary SQL joins;
- `@kysoql/core` must not import JSforce;
- keep the debug package TypeScript-first; do not add checked-in JavaScript source
  files when generated `dist/` output is sufficient.
