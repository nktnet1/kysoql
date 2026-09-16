# kysoql

A type-safe, Kysely-inspired SOQL query builder for TypeScript.

## Workspace

- `@kysoql/core` — typed SOQL AST, query builder, compiler, and result inference.
- `@kysoql/jsforce` — JSforce authentication/execution adapter.
- `@kysoql/codegen` — CLI for generating strongly typed Salesforce schemas from Describe metadata.

## Development

```bash
pnpm install
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

## Design goals

- Kysely-like fluent query API.
- SOQL-native semantics instead of pretending Salesforce is SQL.
- Generated schemas for standard and custom objects/fields.
- Compile-time validation of fields, relationships, operators, grouping, sorting, and projections.
- JSforce used for Salesforce authentication and transport.
- No raw-string escape hatch in the safe API.
