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

### Fixed

- Mark the Apex aggregate test fixture's numeric revenue field as aggregatable so `SUM()` remains covered by the same generated-field capability gate used in production schemas.
- Preserve the generic aggregate QueryAll executor contract in its regression test under TypeScript 7 and Vitest 5.

### Changed

- Publishable packages now declare their Node.js support, public npm access,
  tree-shaking metadata, and package-specific search keywords explicitly.
