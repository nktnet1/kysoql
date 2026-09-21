# Changelog

All notable public changes to kysoql are documented here. The workspace is still
pre-release, so changes remain under **Unreleased** until a public package
version is cut.

## Unreleased

### Added

- `@kysoql/core`: type-safe SOQL query construction, immutable AST/compiler
  primitives, relationship traversal, aggregate/grouping support, typed SOQL
  functions, object-specific query guards, and transport-neutral execution.
- `@kysoql/codegen`: Salesforce Describe-driven schema generation with generated
  field, relationship, scope, MRU, picklist, polymorphic-reference, and
  data-category metadata, plus the `kysoql generate` CLI.
- `@kysoql/jsforce`: JSforce execution adapter with validated paginated query
  results and scalar `COUNT()` execution.
- Salesforce QueryAll execution through `.executeAll()` for record, aggregate,
  and bare `COUNT()` root queries, including JSforce `scanAll` transport and
  paginated deleted/archived results.
- Explicit compile-only Apex query context with typed `FOR UPDATE` record locking,
  including compiler rejection of the unsupported `ORDER BY` combination.
- Apex-only `ALL ROWS` compilation for record, aggregate-result, and bare
  `COUNT()` queries, with explicit separation from API QueryAll execution and
  compiler rejection of `FOR UPDATE` combinations.
- Explicit Apex `WITH USER_MODE` / `WITH SYSTEM_MODE` access clauses on the
  compile-only Apex query surface, with immutable replacement semantics and no
  inferred default mode.
- Typed Apex bind expressions for scalar and `IN` / `NOT IN` filters, grouped
  `WHERE` composition, and numeric `LIMIT` / `OFFSET`, including
  relationship-field binds, validated bind expressions, and Knowledge-article /
  multipicklist guardrails.
- Compile-only Apex contexts for aggregate-result and bare `COUNT()` queries,
  reusing typed `WHERE` binds, pagination binds, and explicit access modes while
  keeping record locking record-only.
- Safe dotted Apex member-path bind expressions such as `:record.Id` across the
  existing typed `WHERE`, `IN` / `NOT IN`, `LIMIT`, and `OFFSET` bind positions,
  without opening a raw-SOQL expression escape hatch.
- Apex-only parent-to-child relationship subqueries can use typed scalar,
  collection, and grouped `WHERE` binds after the root query switches to
  `.apex()`, while API-executable relationship subqueries remain bind-free.
- Apex-only bind-left `INCLUDES` filters, modeled separately from
  Kysoql's existing field-left multipicklist API so right-hand bind values remain
  rejected and literal-list validation/escaping is preserved.
- Structured Apex `+` bind expressions through `apexAdd(...)`, with frozen
  addition/literal AST nodes, typed string or numeric operands, nested bind
  expressions, and support across the existing Apex `WHERE`, `LIMIT`, and `OFFSET`
  bind positions without allowing raw Apex fragments.
- Structured Apex `String.substring(beginIndex, endIndex)` bind expressions through
  `apexSubstring(...)`, with validated non-negative integer indexes, frozen method
  AST nodes, and composition with existing string binds / `apexAdd(...)` without
  admitting arbitrary Apex method-call text.
- Structured single-row Apex query-result field bind expressions through
  `apexQueryField(...)`, accepting only typed plain-mode Apex builders plus selected
  output keys and compiling builder-owned query AST as `:[SELECT ...].Field` without
  exposing a raw nested-query string escape hatch.
- Release validation for built package exports, declaration files, CLI binaries,
  package metadata, package documentation, and changelog presence.
- Publish-shape parity checks that compare each publishable package's source barrel
  with its built runtime named exports and declaration exports, preventing source-only
  or build-only public API drift.
- A real-org static-Apex bind-expression smoke fixture, run automatically by the
  scratch-org setup and independently through `pnpm salesforce:apex-binds`.
- Typed SOQL date-function predicates in ordinary `WHERE` expression callbacks,
  including all thirteen calendar/fiscal functions, filterable date/datetime
  metadata gating, set/ordered operand typing, and `convertTimezone()` composition.
- Structured ISO-coded currency literals through `soqlCurrency(...)` for typed
  currency `WHERE` comparisons, including homogeneous `IN` / `NOT IN` list
  enforcement and exclusion from aggregate `HAVING` comparisons.
- Structured `WITH RecordVisibilityContext (...)` root-query filtering with typed
  `maxDescriptorPerRecord`, `supportsDomains`, and `supportsDelegates` parameters,
  at-least-one validation, immutable replacement semantics, and compiler guards
  against combining it with another SOQL `WITH` form.
- Typed Data 360 `SET OPTIONS` support driven by generated DLO/DMO capability
  metadata: DLO queries require `dataspace` and may opt into `honorEmptyStrings`,
  simple DMO record queries expose only `honorEmptyStrings`, and DLO aggregate /
  bare `COUNT()` queries retain the documented Data 360 aggregate surface.
- A distinct compile-only `.dynamicApex()` context for managed-package dynamic
  SOQL, including typed bound `Database.QueryOptions` support for
  `SET OPTIONS :queryOptions` without admitting that dynamic-only form through
  the existing static `.apex()` context.
- Kysely-style `$call(...)` composition across record, aggregate, count, Apex,
  relationship-subquery, and semi-join query builders, preserving each builder's
  specialised type while returning the callback result unchanged.
- Kysely-style `$if(...)` conditional composition across the same query-builder
  surfaces, with callbacks invoked only for true conditions, conditionally selected
  fields reflected as optional output properties, and structural builder modes kept
  stable across both branches.
- Kysely-style `clearWhere()` across every builder surface that exposes `where()`,
  removing the complete accumulated `WHERE` clause while preserving immutable
  builder state and specialised query modes.
- Kysely-style `clearOrderBy()`, `clearLimit()`, `clearOffset()`, `clearSelect()`,
  and aggregate `clearGroupBy()` across the applicable SOQL builder surfaces,
  including immutable clause removal, selection-type reset, Apex pagination/order/
  grouping cleanup, and guards against clearing grouping when grouped-only SOQL
  state would remain.
- Direct non-aggregate `GROUP BY` from unselected root builders, including typed
  field lists and date grouping functions, so distinct grouped values can be
  queried without introducing a dummy aggregate selection.
- Typed SOQL `toLabel()` predicates in ordinary `WHERE` expression callbacks,
  with generated filterable picklist/multipicklist metadata, translated-string
  operands, nullability-aware equality, picklist `LIKE`, child-to-parent paths,
  and documented `Division` / `CurrencyIsoCode` / external-object restrictions.
- Compiler validation for Salesforce relationship-query cardinality limits: at
  most 20 parent-to-child relationships and 55 child-to-parent relationships per
  query, with repeated relationship paths deduplicated and polymorphic `TYPEOF`
  targets counted according to Salesforce's documented rules.
- The documented grouped-date SELECT exception: ordinary queries grouped by a
  generated raw `date` field can select date functions over that field without
  separately grouping the function expression, while `datetime`, ROLLUP/CUBE,
  HAVING, and date-function ORDER BY retain their stricter boundaries.
- Typed polymorphic relationship `.Type` qualifiers in ordinary SELECT/WHERE
  surfaces, inferred from generated polymorphic `referenceTo` metadata with exact
  target-name equality/set operands, string `LIKE` patterns, parent-path support,
  nullability, and compatibility with `TYPEOF` filters.

### Fixed

- Enforce Salesforce's grouped-query restriction on custom relationship
  expressions using `__r` at both the typed grouping surface and compiler
  boundary, while preserving valid standard relationship grouping such as
  `Owner.Name`.
- Prevent typed root, grouped, and relationship-subquery `orderBy()` calls from
  accepting explicit `NULLS FIRST` / `NULLS LAST` on nullable Salesforce
  reference fields, while preserving null placement for ordinary sortable fields
  and non-nullable references.
- Align unbounded `FIELDS(ALL)` / `FIELDS(CUSTOM)` validation with Salesforce:
  accept REST/SOAP-style queries bounded to at most 200 rows by `LIMIT` or direct
  `Id` tests, reject both selectors in Apex, propagate Apex compile context into
  relationship subqueries/nested query-result expressions, and prevent
  custom-only field lists when generated metadata contains no custom fields.
- Correct the polymorphic `.Type` null-filter regression expectation to match
  the established scalar compiler output (`null`), without changing compiler
  behavior.
- Keep negative `toLabel()` WHERE type tests compile-time-only after an
  expected invalid function call, avoiding follow-on diagnostics from
  deliberately poisoned expressions during strict test typechecking.
- Match the date-function `WHERE` compiler regression expectation to the
  existing top-level boolean formatting contract: redundant outer parentheses
  are omitted while precedence-preserving nested groups remain parenthesised.
- Keep the `FIELDS(CUSTOM)` output regression fixture in sync with the custom
  date fields added for ordinary `WHERE` date-function capability tests, so the
  strict test typecheck validates the complete generated custom-field shape.
- Keep VS Code negative type-test diagnostics aligned with CLI typechecking by
  pointing the workspace at its pinned TypeScript SDK and avoiding
  diagnostic-location-sensitive `@ts-expect-error` placement in Apex bind tests.
- Align VS Code and CLI TypeScript project discovery by placing canonical `tsconfig.json` files in each test/tooling tree and making package test typechecks compile those same editor-discoverable projects.
- Coalesce repeated Salesforce Describe child-relationship names into one generated
  property with an exact union of the concrete child-object / foreign-key pairs,
  avoiding duplicate TypeScript property declarations without discarding metadata.
- Make `pnpm typecheck` / `pnpm validate` explicitly type-check source and test
  code as separate phases, including package Vitest suites, root test tooling,
  and the generated Salesforce TypeScript fixture under `test/`.
- Correct publish-shape runtime classification for type-only default interface
  exports, and add direct regression coverage for the TypeScript-7 export scanner.
- Keep `verify:publish` compatible with TypeScript 7 by parsing the package
  barrel export surface without relying on the removed `typescript` root compiler
  API.
- Keep compile-only Apex substring and query-result type assertions lint-clean by wrapping them in uninvoked arrow expressions instead of constant-false branches.
- Mark the Apex aggregate test fixture's numeric revenue field as aggregatable so `SUM()` remains covered by the same generated-field capability gate used in production schemas.
- Preserve the generic aggregate QueryAll executor contract in its regression test under TypeScript 7 and Vitest 5.

### Changed

- Publishable packages now declare their Node.js support, public npm access,
  tree-shaking metadata, and package-specific search keywords explicitly.
