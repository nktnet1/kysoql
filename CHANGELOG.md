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
- Release validation for built package exports, declaration files, CLI binaries,
  package metadata, package documentation, and changelog presence.

### Changed

- Publishable packages now declare their Node.js support, public npm access,
  tree-shaking metadata, and package-specific search keywords explicitly.
