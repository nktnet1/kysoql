# @kysoql/codegen

Salesforce Describe-driven schema generation for kysoql. Generated TypeScript
captures the field and relationship capabilities used by `@kysoql/core` for
compile-time query validation.

## Install

```bash
pnpm add -D @kysoql/codegen
```

Set the Salesforce connection environment variables and generate a schema:

```bash
export SF_INSTANCE_URL="https://example.my.salesforce.com"
export SF_ACCESS_TOKEN="..."

pnpm exec kysoql generate \
  --object Account \
  --object Contact \
  --output src/salesforce.generated.ts \
  --schema-name SalesforceSchema
```

`--object` is repeatable. Omit it to include every queryable object returned by
Salesforce. Run `pnpm exec kysoql generate --help` for the complete command
reference.

## Library API

The package also exports `generateSchema`, `loadSchema`, `renderSchema`, and the
normalized Salesforce Describe types for programmatic generation workflows.
