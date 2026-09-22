# @kysoql/codegen

Salesforce Describe-driven schema generation for kysoql. Generated TypeScript
captures the field and relationship capabilities used by `@kysoql/core` for
compile-time query validation. It also derives Data 360 `SET OPTIONS` capability
metadata from Salesforce's DLO (`__dll`) and DMO (`__dlm`) API-name suffixes.

## Install

```bash
pnpm add -D @kysoql/codegen
```

Create `kysoql.config.ts` beside your application's `package.json`:

```ts
import { defineConfig } from "@kysoql/codegen";

export default defineConfig({
  objects: ["Account", "Contact"],
  output: "src/salesforce.generated.ts",
  schemaName: "SalesforceSchema",
});
```

Set `SF_INSTANCE_URL` and `SF_ACCESS_TOKEN` in the process environment, then run:

```bash
pnpm exec kysoql generate
```

The CLI also works without a config:

```bash
pnpm exec kysoql generate --no-config \
  --object Account \
  --object Contact \
  --output src/salesforce.generated.ts \
  --schema-name SalesforceSchema
```

## Configuration

`defineConfig` is a typed identity helper. `KysoqlConfig` has three optional
properties: `objects`, `output`, and `schemaName`. Export a plain object; functions,
promises, and config arrays are not supported. Unknown keys, invalid types, blank
strings, and invalid schema names fail before connecting to Salesforce.

Discovery checks the working directory only for `kysoql.config.ts`, `.mts`,
`.cts`, `.js`, `.mjs`, and `.cjs`. The TypeScript-aware loader supports
extensionless relative helper imports. Use a default export, or `module.exports`
in `.cts`/`.cjs`. Multiple discovered configs require explicit selection:

```bash
pnpm exec kysoql generate --config config/kysoql.sandbox.ts
```

Explicit flags override config values, then built-in defaults apply. Repeated
`--object` flags replace the configured list. Without a list (or with `objects:
[]`), generation includes every queryable object returned by Salesforce. Defaults
remain `salesforce.generated.ts` and the `SalesforceSchema` interface name.

A configured `output`, including the default when a config is loaded, is relative
to that file's directory. `--config` and an explicit `--output` are relative to
the working directory. Absolute paths remain absolute. `--no-config` skips
loading entirely and cannot be combined with `--config`.

Configuration modules execute code: only load trusted files. Authentication stays
in `SF_INSTANCE_URL` and `SF_ACCESS_TOKEN`; `.env` files are not loaded
automatically. A config does not select an org or configure application runtime
clients. Use environment-specific credentials and output files for multiple orgs.
Run `pnpm exec kysoql generate --help` for the complete command reference.

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

Programmatic generation does not discover config files: pass options explicitly.
Its relative output paths continue to use the process working directory.
