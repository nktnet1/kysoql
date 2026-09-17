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

Through `v1.0.16`, the project has:

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
- immutable `WhereNode`, `BinaryOperationNode`, `OperatorNode`, `ValueNode`, and `AndNode` filtering AST;
- Kysely-style `CompiledQuery<O>` / `QueryCompiler` abstractions and `.compile()` for selected scalar fields, chained `AND` filters, scalar string/number/boolean/null literals, and the currently supported comparison operators;
- `docs/research-notes.md` records external references and settled findings that would otherwise be repeatedly researched in future sessions;
- a transport-neutral `QueryExecutor` contract plus `SelectQueryBuilder.execute()` with selected-output typing preserved;
- `@kysoql/jsforce` adapts a JSforce connection to that executor, compiles no SOQL itself, and follows `nextRecordsUrl` through all result pages instead of silently truncating;
- SOQL-safe escaping for quoted strings, including preserved `\%` / `\_` LIKE wildcard escapes;
- compile-time rejection of unknown/non-filterable fields, unsupported operators, and mismatched filter values;
- `pnpm validate` as the type/test/build validation gate; Biome stays manual;
- `pnpm debug` as a no-Salesforce TypeScript runtime playground that logs the AST produced
  by `selectFrom()`, `select()`, and chained `where()` calls, then logs compile and mock
  execution behavior; source files remain `.ts` and generated JavaScript lives only in ignored `dist/` output.

There is intentionally no ordering, OR-expression builder, or broader SOQL operator surface in core yet. Date/dateTime/time literals still need a dedicated representation before the compiler can claim complete literal coverage; generated field values currently represent those Salesforce types as strings.

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

The sequence at this point is:

```text
v1.0.0 -> v1.0.1 -> ... -> v1.0.16
```

The next patch must therefore be `v1.0.17-kysoql.patch`, generated against the
state after `v1.0.16` is applied. Before handing it off, verify at minimum:

```bash
git apply --check v1.0.17-kysoql.patch
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

Keep the next patch small. The expected `v1.0.17` slice is explicit Salesforce
date/dateTime/time literal representation and compilation. Generated fields for
those Salesforce types currently use plain TypeScript strings, but SOQL requires
unquoted dedicated literal formats; do not execute those values by guessing from
a string. Add explicit typed wrappers or another similarly unambiguous
representation, compiler coverage, and compile-time/runtime tests without mixing
in ordering or additional boolean-expression syntax.

The execution layer added in `v1.0.16` should remain unchanged in that patch.
Core owns compilation and the executor contract; the JSforce package remains a
transport adapter and must continue to fetch every result page.

In particular, preserve these design choices:

- immutable builders and AST cloning;
- repeated `.where()` calls combine through the Kysely-style `WhereNode` /
  `AndNode` structure;
- filtering must honor generated `filterable` metadata;
- operator availability must remain Salesforce-field-type-aware;
- the public API uses Kysely-style lowercase `like`; the compiler emits SOQL
  `LIKE`;
- output type accumulation using Kysely's `O & Selection<...>` pattern;
- `.compile()` must preserve the selected output type through the type-only `CompiledQuery<O>` carrier;
- execution stays transport-neutral in core;
- JSforce execution must not silently truncate paginated query results;
- no raw SOQL escape hatch in the safe API;
- no arbitrary SQL joins;
- `@kysoql/core` must not import JSforce;
- keep the debug package TypeScript-first; do not add checked-in JavaScript
  source files when generated `dist/` output is sufficient.
