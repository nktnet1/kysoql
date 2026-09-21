# ChatGPT continuation handoff

Use this file when continuing kysoql from a fresh ChatGPT session. It describes
how to work on the repository, the architecture that must remain stable, and the
small set of confirmed follow-on items. Historical patch-by-patch detail belongs
in Git history and `CHANGELOG.md`, not here.

## Start here

1. Treat the supplied Git bundle/repository as authoritative. Inspect the actual
   branch, commit, working tree, package structure, and relevant implementation
   before changing anything.
2. Read this file and `docs/research-notes.md` before architectural work.
3. Work in one coherent slice at a time. Do not mix the next feature, cleanup,
   refactor, or speculative roadmap work into the same patch.
4. Patch filenames are sequential: `v1.0.<n>-<short-description>.patch`. Never
   reuse a version already handed off.
5. When dependencies are available, use `pnpm validate` as the main local gate.
   If the user supplies a validation failure, fix that failure before moving on.
6. Before handing off a patch, at minimum run `git diff --check` and verify the
   patch applies cleanly against the immediately preceding accepted state.
7. Hand off the patch with a short summary and one Conventional Commit command.
   Do not include patch-application instructions unless asked.
8. Update this file only when architecture, continuation rules, or the remaining
   roadmap materially changes. Do not append a patch diary.

## Project intent

kysoql is a TypeScript, Kysely-inspired query builder for Salesforce SOQL. The
safe API should remain SOQL-native and type-driven from generated Salesforce
Describe metadata.

Package boundaries are intentional:

- `@kysoql/core` owns schema types, immutable query ASTs, builders, type
  inference, compilation, and the transport-neutral executor contract. It must
  remain JSforce-independent.
- `@kysoql/codegen` consumes Salesforce Describe metadata and generates the
  schema/capability metadata used by core.
- `@kysoql/jsforce` is the Salesforce transport/execution adapter and validates
  external query/pagination payloads.
- `@kysoql/debug` is a private TypeScript playground and is not a publishable
  package.

Follow Kysely's immutable-builder and public-API conventions where they map
cleanly to SOQL. Do not copy SQL-only semantics such as arbitrary joins or a raw
SQL escape hatch.

## Current baseline

The accepted continuation baseline is through **`v1.0.127`**, which adds
Kysely-style `$call(...)` and `$if(...)` composition across the query-builder
surfaces on top of structured `WITH RecordVisibilityContext (...)`, ISO-coded
currency literals, Apex `ALL ROWS`, and the documentation-pruning work.

The implementation already covers the broad production SOQL surface:

- typed root selections with additive output inference;
- immutable AST/parser/compiler architecture;
- generated filterable, sortable, groupable, aggregatable, custom, picklist,
  polymorphic-reference, relationship, scope, MRU, and data-category metadata;
- typed scalar filtering, grouped boolean expressions, `IN` / `NOT IN`,
  multipicklist `INCLUDES` / `EXCLUDES`, temporal/relative-date literals, and
  ISO-coded multi-currency `WHERE` literals;
- child-to-parent traversal, parent-to-child relationship subqueries, semi-joins,
  anti-joins, relationship-count limits, and polymorphic `.Type` qualifiers;
- `TYPEOF` with generated target typing and its SOQL compatibility restrictions;
- aggregate selection, bare `COUNT()`, `GROUP BY`, `ROLLUP`, `CUBE`, `HAVING`,
  aggregate ordering, `GROUPING()`, and date grouping/filter functions;
- `toLabel()`, `convertCurrency()`, `convertTimezone()`, `FORMAT()`, geolocation
  expressions, and `FIELDS(STANDARD|CUSTOM|ALL)`;
- `USING SCOPE`, `WITH DATA CATEGORY`, structured `WITH RecordVisibilityContext`,
  `FOR VIEW`, `FOR REFERENCE`, Knowledge tracking/view-stat clauses, and the
  currently modeled object-specific query restrictions;
- `ORDER BY` including null placement, `LIMIT`, and `OFFSET`;
- transport-neutral compilation/execution plus JSforce pagination and QueryAll;
- compile-only Apex query contexts with `FOR UPDATE`, `ALL ROWS`, explicit
  `WITH USER_MODE` / `WITH SYSTEM_MODE`, typed bind expressions, relationship
  subquery binds, bind-left `INCLUDES`, structured addition/substring expressions,
  and structured nested query-result field binds;
- Describe-driven code generation, oclif CLI packaging, release/export parity
  checks, and Salesforce scratch-org fixtures.

For exact public APIs and object-specific rules, inspect the implementation and
package README. Do not duplicate those details here.

## Design invariants

Preserve these unless a change is explicitly justified:

- builders clone immutable/frozen AST state rather than mutating earlier builders;
- repeated top-level `.where()` calls combine with `AND`;
- expression callbacks preserve boolean precedence through AST nodes;
- field/operator availability comes from generated Salesforce capabilities;
- `.select()` output accumulates through typed intersection-style selection;
- `.compile()` preserves the selected result type through `CompiledQuery<O>`;
- temporal result values remain strings while filter literals use explicit typed
  wrappers;
- core execution remains transport-neutral and `@kysoql/core` never imports
  JSforce;
- JSforce execution must not silently truncate paginated results;
- Apex-only syntax stays behind the compile-only `.apex()` boundary;
- no raw SOQL escape hatch and no arbitrary SQL joins;
- source imports inside a package use `#/...`; cross-package imports use workspace
  package names rather than another package's `src`/`dist` internals;
- generated truly-empty maps use `Record<string, never>`, while query-selection
  accumulator identities use `unknown`;
- use Valibot at real runtime/external boundaries, not for impossible internal
  AST states.

## Remaining roadmap

Keep this list limited to confirmed missing/documented surface or a concrete
Kysely-parity concern. Remove an item when it is implemented or deliberately
closed.

1. **`FORMULA()` in `WHERE` (beta).** Salesforce currently documents arithmetic
   `FORMULA()` predicates for supported numeric/date/currency field pairs using
   `+` / `-`. Treat this as opt-in beta surface and model it structurally if the
   project chooses to support beta SOQL; do not expose raw formula text.
2. **Relationship-subquery `OFFSET` pilot.** Salesforce documents subquery
   `OFFSET` only when the parent query has `LIMIT 1`, and still labels the feature
   pilot/not for production. Keep it omitted unless Salesforce promotes it to a
   production-supported feature or the project explicitly opts into pilot syntax.
3. **Remaining Kysely-neutral builder ergonomics.** Kysoql now matches Kysely's
   neutral `$call` and `$if` composition helpers. Audit `clearWhere`,
   `clearOrderBy`, `clearLimit`, `clearOffset`, `clearSelect`, and `clearGroupBy`
   as potential unnecessary deviations, and add only helpers whose semantics
   remain sound across the relevant SOQL builder modes. SQL joins/raw-expression
   APIs are not parity gaps.

Specialist-object restrictions that depend on unavailable adapter metadata,
permissions, runtime cardinality, or product-specific execution context are not
roadmap items by themselves. Add one only when there is an authoritative rule the
library can soundly model.

## Validation

Preferred local gate:

```bash
pnpm validate
```

Formatting/linting remains separate:

```bash
pnpm check
pnpm check --write
```

Release metadata/public-shape checks can be run independently:

```bash
pnpm verify:release
```

Salesforce fixture/schema commands require an authenticated org and must never
print or commit credentials:

```bash
pnpm salesforce:setup
pnpm salesforce:schema -- \
  --object Account \
  --object Kysoql_Record__c \
  --output test/salesforce/salesforce.generated.ts
```

For a future bundle handoff, remember that `git bundle` contains committed history
only. Inspect the new bundle first; this document must never override newer code.
