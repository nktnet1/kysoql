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

Through `v1.0.19`, the project has:

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

There is intentionally no `OFFSET`, null-order modifier, OR-expression builder,
relative Salesforce date-literal support such as `TODAY`
/ `LAST_N_DAYS:n`, or broader SOQL operator surface in core yet.

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
v1.0.0 -> v1.0.1 -> ... -> v1.0.18 -> v1.0.19
```

The next delivered patch must therefore be `v1.0.20-kysoql.patch`, generated
against the complete state after `v1.0.19` is applied. If a test/refactor/config
patch is delivered before the next planned feature, that patch becomes `v1.0.20`
and the feature moves to `v1.0.21`. Before handing off any patch, verify at
minimum (substituting the actual next version):

```bash
git apply --check v1.0.20-kysoql.patch
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

## Next incremental milestone

Keep the next patch small. If the next delivered patch is feature work, the
expected `v1.0.20` slice is typed `OFFSET` support. If any other patch is handed
off first, it consumes `v1.0.20` and this milestone shifts to `v1.0.21`.

For the first offset slice:

- add an offset AST node and compiler support without touching execution;
- expose `.offset(...)` on `SelectQueryBuilder` with a safe numeric surface;
- honor Salesforce's documented `0..2000` offset range;
- a later `.offset(...)` call should deterministically replace the earlier
  offset rather than append a second SOQL `OFFSET` clause;
- add AST/compiler/runtime-validation tests plus a minimal debug example;
- do not mix in `NULLS FIRST` / `NULLS LAST`, OR-expression syntax, relative
  date literals, or new comparison operators in the same patch.

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
- `.compile()` must preserve the selected output type through the type-only `CompiledQuery<O>` carrier;
- temporal filter literals stay explicit and type-matched to `date`, `datetime`,
  and `time` fields;
- execution stays transport-neutral in core;
- JSforce execution must not silently truncate paginated query results;
- no raw SOQL escape hatch in the safe API;
- no arbitrary SQL joins;
- `@kysoql/core` must not import JSforce;
- keep the debug package TypeScript-first; do not add checked-in JavaScript
  source files when generated `dist/` output is sufficient.
