# kysoql

A type-safe, Kysely-inspired SOQL query builder for TypeScript.

## Workspace

- `@kysoql/core` — typed SOQL AST, query builder, compiler, and result inference.
- `@kysoql/jsforce` — JSforce authentication/execution adapter.
- `@kysoql/codegen` — CLI for generating strongly typed Salesforce schemas from Describe metadata.

## Requirements

- Node.js 26 (`package.json` enforces the Node 26 range; `.node-version` pins 26.8.2 for version managers that support it).
- pnpm 12.4.1 via Corepack.

```bash
nvm use
corepack enable
pnpm install
```

## Development

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Vitest is configured at the workspace root and discovers tests under
`packages/**/src/**/*.test.ts`. V8 coverage output is written to `coverage/`.

## Salesforce test org

A reproducible scratch-org fixture is included under `test/salesforce`. It
contains standard Account/Contact data plus a `Kysoql_Record__c` custom object
with representative scalar, picklist, external-ID, and relationship fields.

See [docs/salesforce-test-org.md](docs/salesforce-test-org.md) for the complete
create → deploy → seed → SOQL smoke-test workflow.

## Design goals

- Kysely-like fluent query API.
- SOQL-native semantics instead of pretending Salesforce is SQL.
- Generated schemas for standard and custom objects/fields.
- Compile-time validation of fields, relationships, operators, grouping, sorting, and projections.
- JSforce used for Salesforce authentication and transport.
- No raw-string escape hatch in the safe API.
