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

`defineConfig` is a typed identity helper. `KysoqlConfig` has four optional
properties: `objects`, `fields`, `output`, and `schemaName`. Export a plain object; functions,
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

## Per-object field filters

Keep all fields by default, or opt into one exact-name rule per object:

```ts
import { defineConfig } from "@kysoql/codegen";

export default defineConfig({
  objects: ["Account", "Contact", "User"],
  fields: {
    Account: { include: ["Id", "Name", "OwnerId"] },
    Contact: { exclude: ["Description"] },
  },
  output: "src/salesforce.generated.ts",
});
```

`User` retains all described fields. `include` and `exclude` are mutually
exclusive. Empty includes, unknown or unavailable fields, and rules that remove
every field fail generation without updating the output. Empty excludes are
allowed. Field names are exact and case-sensitive; wildcards, regular
expressions, and dotted relationship paths are not supported.

Rules never add objects. `--object` replaces the object list, while rules for
selected objects still apply; rules for other known objects are not described.
All rule object names must be queryable in global Describe, even when inactive.
Use `--no-config` to bypass configured rules entirely. There are no field CLI flags.

Retain fields used in predicates, sorting, grouping, and lookups as well as
selections. No fields (including `Id`) are silently restored. Removing a lookup
removes its parent path and inverse child relationship. Polymorphic target unions
remain intact; omitted targets are never reclassified as a single target.

Every explicitly filtered object uses the trailing `SalesforceObject` parameter
`FieldsComplete = false`. All typed `selectFields(...)` selectors are disabled on
those objects and child subqueries; use explicit selections. This also applies
to a no-op rule such as `exclude: []`. Update both codegen and core before
regenerating. Unfiltered output is unchanged.

Filtering reduces generated metadata, not Describe requests or runtime access.
It is not a security boundary. The
[field filtering guide](../../apps/docs/content/docs/getting-started/field-filtering.mdx)
covers relationship dependencies, validation, and migration.

## Library API

The package also exports `generateSchema`, `loadSchema`, `renderSchema`, and the
normalized Salesforce Describe types for programmatic generation workflows.

Programmatic generation does not discover config files: pass options explicitly.
Its relative output paths continue to use the process working directory.


`generateSchema({ client, output, objects, fields })` uses the same
`ObjectFieldFilters` rules as the config. For a preview without writing a file,
pass them to `loadSchema(client, objects, fields)` and then call `renderSchema`.
`loadSchema` annotates filtered descriptions with `fieldsComplete: false`, and
`renderSchema` preserves that annotation in the generated object type.
