# @kysoql/codegen

Salesforce Describe-driven schema generation for kysoql. Generated TypeScript
captures the field and relationship capabilities used by `@kysoql/core` for
compile-time query validation. It also derives Data 360 `SET OPTIONS` capability
metadata from Salesforce's DLO (`__dll`) and DMO (`__dlm`) API-name suffixes.

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

Generated schema files are build artifacts: they include a `Do not edit manually`
header and should be regenerated from Salesforce Describe metadata rather than
hand-edited. Field capabilities use named metadata so generated output remains
inspectable without memorising positional boolean arguments:

```ts
readonly AccountNumber: SalesforceField<
  string,
  {
    readonly salesforceType: "string";
    readonly nullable: true;
    readonly filterable: true;
    readonly sortable: true;
    readonly groupable: true;
  }
>;
```

Less common metadata is emitted only when it is meaningful. For example,
`referenceTo`, `relationshipName`, `activePicklistValue`, `aggregatable`,
`custom`, and `polymorphic` are omitted when they have their default
`never`/`false` values.

## Library API

The package also exports `generateSchema`, `loadSchema`, `renderSchema`, and the
normalized Salesforce Describe types for programmatic generation workflows.
