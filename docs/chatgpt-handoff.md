# ChatGPT continuation handoff

This is the primary continuity document for a **new ChatGPT instance with no
conversation context**. Read it before changing code or generating a patch.
`docs/research-notes.md` contains the external references and settled Salesforce /
Kysely findings that support the architecture below.

## Fresh-session bootstrap: do this first

1. **Treat the supplied Git bundle/repository as authoritative.** Inspect its
   actual state before trusting version numbers in this document. A Git bundle
   contains committed history only; it does not contain somebody else's
   uncommitted working tree.
2. Read this file and `docs/research-notes.md` before making architectural
   changes.
3. Inspect the current package/test structure and the immediately relevant
   implementation before researching externally. Most continuation work should
   be derivable from the code and these docs; avoid long research detours unless
   a Salesforce rule is genuinely unclear.
4. If dependencies are available, run `pnpm validate` before and after the
   change. The user commonly runs validation locally and supplies any failure
   log; if so, fix **that failure only** before moving on.
5. Work in **small incremental slices**. One delivered patch should represent one
   coherent unit of work with focused tests. Do not bundle the next roadmap item,
   cleanup, or unrelated refactors into it.
6. Patch filenames are sequential: `v1.0.<n>-<short-description>.patch`. Never
   reuse or rewrite a version already handed off. After `v1.0.46`, the next patch
   is `v1.0.47`.
7. Before handing off a patch, at minimum run:

   ```bash
   git diff --check
   git apply --check /path/to/v1.0.<n>-*.patch
   ```

   Also run the narrowest available type/test command. Do not repeatedly tell the
   user that pnpm or dependencies are unavailable in the execution environment;
   they already know. Report the checks that were actually completed and let the
   user run `pnpm validate` locally.
8. The user prefers the current workflow: implement a small slice, provide the
   patch, wait for their `validate` result, then continue. Do not spend a long
   time exploring future features.
9. Update this handoff whenever the current milestone or patch sequence changes,
   so the next no-context session does not need the conversation history.

## Project intent

kysoql is a TypeScript, Kysely-inspired query builder for Salesforce SOQL. The
safe API should remain SOQL-native and fully type-driven from generated
Salesforce Describe metadata.

Package boundaries are intentional:

- `@kysoql/core` owns schema types, immutable query ASTs, query builders, type
  inference, compilation, and the transport-neutral executor contract. It must
  stay JSforce-independent.
- `@kysoql/codegen` uses Salesforce Describe metadata to generate the schema
  consumed by core. It supports standard/custom objects and generated field /
  relationship metadata.
- `@kysoql/jsforce` is the JSforce transport/execution adapter. It validates
  external query/pagination payloads before handing records to core's executor
  abstraction.
- `@kysoql/debug` is a private, deliberately minimal TypeScript playground. It is
  not shipped to end users and does not need tsdown merely for consistency.

Follow Kysely's public API and immutable-AST architecture where it maps cleanly
to SOQL. Do not copy SQL-only semantics such as arbitrary joins.

## Current state after `v1.0.46`

The current continuation state includes all earlier work plus the following
recent patch sequence:

| Patch | Purpose |
| --- | --- |
| `v1.0.27` | Fix TypeScript `#/*` source alias resolution by mapping to `./src/*.ts`. |
| `v1.0.28` | Fix published-package source/build resolution using the `development` condition and Turbo dependency builds. |
| `v1.0.29` | Convert publishable `@kysoql/codegen` to tsdown, including its CLI entry. |
| `v1.0.30` | Convert publishable `@kysoql/jsforce` to tsdown and add root `pnpm t` as an alias of `pnpm test`. |
| `v1.0.31` | Validate JSforce `query` / `queryMore` payloads with Valibot. |
| `v1.0.32` | Normalize optional `nextRecordsUrl` for `exactOptionalPropertyTypes`. |
| `v1.0.33` | Add typed `OFFSET` with immutable AST, replacement semantics, compiler support, and Salesforce's `0..2000` bound. |
| `v1.0.34` | Add `ORDER BY ... NULLS FIRST|LAST`. |
| `v1.0.35` | Add grouped `OR` expression callbacks. |
| `v1.0.36` | Add nested grouped `AND` expression callbacks. |
| `v1.0.37` | Add logical `NOT` expressions. |
| `v1.0.38` | Add typed scalar-list `IN` / `NOT IN`. |
| `v1.0.39` | Keep negative `IN` type assertions compile-time-only so Vitest does not execute deliberately invalid calls. |
| `v1.0.40` | Add multi-select-picklist-specific `INCLUDES` / `EXCLUDES` using generated active picklist values; refresh this handoff. |
| `v1.0.41` | Add branded fixed relative date literals (`TODAY`, `YESTERDAY`, `TOMORROW`) for date/datetime filters. |
| `v1.0.42` | Extend `soqlRelativeDate(...)` with validated `LAST_N_DAYS:n` / `NEXT_N_DAYS:n` factory forms. |
| `v1.0.43` | Extend `soqlRelativeDate(...)` with validated `LAST_N_MONTHS:n` / `NEXT_N_MONTHS:n` factory forms. |
| `v1.0.44` | Add fixed `LAST_MONTH`, `THIS_MONTH`, and `NEXT_MONTH` relative-date literals. |
| `v1.0.45` | Add fixed `LAST_QUARTER`, `THIS_QUARTER`, and `NEXT_QUARTER` relative-date literals. |
| `v1.0.46` | Add fixed `LAST_YEAR`, `THIS_YEAR`, and `NEXT_YEAR` relative-date literals. |

### Build/tooling state

- Workspace targets Node 26, pnpm, Turborepo, TypeScript 7, Vitest, Biome, and
  tsdown.
- `@kysoql/core`, `@kysoql/codegen`, and `@kysoql/jsforce` are publishable and
  build with tsdown.
- `@kysoql/debug` is private and intentionally remains a simple `tsc`-built
  playground.
- Root `pnpm test` and `pnpm t` both run `vitest run`.
- `pnpm validate` is the required validation gate: TypeScript typecheck, Vitest,
  then package builds. Biome is intentionally separate under `pnpm check`.

### Package import/export convention

Inside a package, TypeScript source uses `#/...`, never new relative `./` / `../`
imports. Each package maps source imports in TypeScript like this:

```json
{
  "compilerOptions": {
    "paths": {
      "#/*": ["./src/*.ts"]
    }
  }
}
```

Publishable packages use package imports/exports with a named `development`
condition pointing at source and a normal/default condition pointing at built
`dist` output. Their tsdown configs use:

```ts
exports: {
  devExports: "development",
}
```

`@kysoql/codegen` additionally has separate `index` and CLI entries and keeps the
CLI out of package exports. Cross-package imports always use workspace package
names such as `@kysoql/core`; never reach into another package's `src` or `dist`.

### Core query surface currently implemented

Core currently has:

- `Kysoql<DB> -> QueryCreator<DB> -> SelectQueryBuilder<DB, TB, O>`;
- immutable builders and frozen operation nodes;
- typed `selectFrom()` and additive `.select()` with selected-output accumulation;
- field-aware `.where(field, operator, value)` plus expression callbacks;
- equality, ordered comparisons, lowercase `like`, scalar-list `in` / `not in`,
  and multipicklist `includes` / `excludes`;
- explicit `soqlDate(...)`, `soqlDateTime(...)`, and `soqlTime(...)` absolute
  temporal filter literals;
- branded `soqlRelativeDate(...)` support for fixed `TODAY`, `YESTERDAY`, and
  `TOMORROW`, `LAST_MONTH`, `THIS_MONTH`, `NEXT_MONTH`, `LAST_QUARTER`,
  `THIS_QUARTER`, `NEXT_QUARTER`, `LAST_YEAR`, `THIS_YEAR`, and `NEXT_YEAR` plus
  validated `LAST_N_DAYS:n`, `NEXT_N_DAYS:n`, `LAST_N_MONTHS:n`, and
  `NEXT_N_MONTHS:n` forms on `date` / `datetime` filters;
- grouped `eb.or([...])`, grouped/nested `eb.and([...])`, and `eb.not(expr)`;
- typed `.orderBy(field, direction?, nulls?)`, additive in call order;
- `.limit(number)` with non-negative safe-integer validation and replacement on
  repeated calls;
- `.offset(number)` with integer `0..2000` validation and replacement on repeated
  calls;
- `CompiledQuery<O>`, compiler output, transport-neutral execution, and the
  JSforce adapter with full explicit pagination;
- generated field metadata for filterable/sortable/groupable flags, active
  picklist values, and parent/child relationships.

Important current filter typing rules:

- operators remain constrained by Salesforce field type/capability metadata;
- `IN` / `NOT IN` accept typed non-empty readonly value lists;
- `INCLUDES` / `EXCLUDES` are available only on generated `multipicklist` fields
  and their list members are constrained to the field's generated active
  picklist-value union;
- negative compile-time assertions that would intentionally throw at runtime
  should be placed inside an uninvoked function in Vitest files.

## Current next slice

**The next patch should be `v1.0.47` and should add only the fixed fiscal-year
relative-date literals.** Keep them in the existing branded representation.

Recommended next unit:

- add `LAST_FISCAL_YEAR`, `THIS_FISCAL_YEAR`, and `NEXT_FISCAL_YEAR` through the
  one-argument `soqlRelativeDate(...)` factory;
- validate them through the existing fixed-literal path and compile them
  unquoted;
- add focused factory/type/compiler tests;
- do **not** add parameterized fiscal periods, relationship traversal, or
  subqueries in the same patch.

If the supplied bundle already contains `v1.0.47` or later, inspect the code and
advance from the actual state instead of reimplementing this section.

## Remaining roadmap after the next slice

Keep these as separate incremental patches or short patch series:

1. **Finish relative date literals after the fixed fiscal-year slice.** Add any
   remaining fiscal-period variants in separate small slices with explicit
   validation. They must not be ordinary strings or be smuggled through
   `soqlDate(...)`.
2. **Relationship paths and relationship queries.** First child-to-parent dotted
   field paths in selection/filter/order, then parent-to-child subqueries. Use
   generated relationship metadata; no arbitrary SQL joins.
3. **Semi-joins and anti-joins.** Extend `IN` / `NOT IN` to typed subquery operands
   and enforce Salesforce reference/ID and nesting restrictions where practical.
4. **Aggregate queries.** `COUNT`, `COUNT(field)`, `COUNT_DISTINCT`, `SUM`, `AVG`,
   `MIN`, `MAX`, aliases, `GROUP BY`, `HAVING`, `ROLLUP`, `CUBE`, and `GROUPING()`.
   This is a major output-type architecture change.
5. **Broader SELECT expressions/functions.** `FIELDS(...)`, `toLabel()`,
   `FORMAT()`, `convertCurrency()`, calendar/date functions,
   `convertTimezone()`, and geolocation expressions where safely modelable.
6. **Polymorphic references / `TYPEOF`.** Dedicated AST and discriminated output
   typing.
7. **Specialist top-level clauses.** `USING SCOPE`, `WITH DATA CATEGORY`, and
   other REST/SOAP-relevant specialist clauses.
8. **Execution-context-specific syntax.** Re-evaluate Apex-only semantics such as
   `FOR UPDATE`, `WITH USER_MODE`, binds, etc. separately from the
   transport-neutral REST/JSforce core.

The two largest future architecture changes remain relationship queries and
aggregate queries. Avoid redesigning them while implementing small operators or
literal families.

## Validation and runtime-boundary conventions

Preferred local validation after every patch:

```bash
pnpm validate
```

Formatting/linting is separate:

```bash
pnpm check
```

Salesforce fixture/schema commands require an authenticated org and remain
separate:

```bash
pnpm salesforce:setup
pnpm salesforce:schema -- \
  --object Account \
  --object Kysoql_Record__c \
  --output test/salesforce/salesforce.generated.ts
```

Never commit or print Salesforce access tokens.

Use Valibot at genuine external/runtime boundaries: CLI/env input, Salesforce
Describe/query payloads, transport pagination payloads, numeric builder inputs,
and explicit literal factories. Prefer the namespace import:

```ts
import * as v from "valibot";
```

For fallible external inputs, prefer `v.safeParse(...)`; use
`v.summarize(result.issues)` when a human-readable validation summary is useful.
Do not force Valibot onto impossible internal AST/compiler states that represent
programmer errors.

## Design invariants to preserve

- immutable builder cloning and frozen AST nodes;
- repeated top-level `.where()` calls combine with `AND`;
- expression callbacks preserve precedence explicitly through the AST/compiler;
- filter/order/group capability checks come from generated Salesforce metadata;
- operator availability remains Salesforce-field-type-aware;
- builder spelling follows Kysely-style lowercase operators/directions where
  appropriate; compiler output uses SOQL spelling/casing;
- `.select()` output typing continues to accumulate through `O & Selection<...>`;
- `.compile()` preserves the selected output type through `CompiledQuery<O>`;
- result temporal values remain strings, while filter temporal literals are
  explicit typed wrappers;
- execution remains transport-neutral in core;
- JSforce execution never silently truncates paginated results;
- no raw SOQL escape hatch in the safe API;
- no arbitrary SQL joins;
- `@kysoql/core` never imports JSforce;
- do not add checked-in generated JavaScript source where ignored `dist/` output
  is sufficient.

## Patch creation discipline

Patches are generated against the immediately preceding complete state. Do not
rewrite an older artifact once handed off. Every feature, fix, test-only patch,
docs patch, or configuration patch consumes the next version exactly once.

For a future project-bundle handoff, first commit the repository state because
`git bundle` excludes uncommitted changes:

```bash
git status
git bundle create project.bundle --all
```

When a fresh bundle is supplied later, inspect it first. This document describes
intent/current continuation state but must not override newer code in the bundle.
