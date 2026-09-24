# @kysoql/codegen

Salesforce Describe-driven schema generation for kysoql. Generated TypeScript
captures the field and relationship capabilities used by `@kysoql/core` for
compile-time query validation. It also derives Data 360 `SET OPTIONS` capability
metadata from Salesforce's DLO (`__dll`) and DMO (`__dlm`) API-name suffixes.

## Install

```bash
pnpm add @kysoql/auth @kysoql/core
pnpm add -D @kysoql/codegen
```

`@kysoql/auth` is used by the configuration example below, while generated
schema files import the schema helper types from `@kysoql/core`.

Create `kysoql.config.ts` beside your application's `package.json`:

```ts
import { SalesforceAuth } from "@kysoql/auth";
import { defineConfig } from "@kysoql/codegen";
const auth = new SalesforceAuth({
  loginUrl: "https://login.salesforce.com",
  clientId: "external-client-app-id",
});

export default defineConfig({
  auth: () =>
    auth.jwtBearer({
      username: "integration@example.com",
      privateKey: { type: "file", path: "./salesforce-auth-key.pem" },
    }),
  objects: ["Account", "Contact"],
  schemaName: "SalesforceSchema",
});
```

Then run:

```bash
pnpm exec kysoql generate
```

The CLI also works without a config:

```bash
pnpm exec kysoql generate --no-config \
  --auth config/salesforce.auth.ts \
  --object Account \
  --object Contact \
  --output src/kysoql/salesforce.generated.ts \
  --schema-name SalesforceSchema
```

## Configuration

`defineConfig` is a typed identity helper. `KysoqlConfig` accepts an optional `auth` provider plus `apiVersion`, `objects`, `fields`, `output`, and `schemaName`. Export a plain object; functions,
promises, and config arrays are not supported. Unknown keys, invalid types, blank
strings, and invalid schema names fail before connecting to Salesforce.

Discovery checks the working directory only for `kysoql.config.ts`, `.mts`,
`.cts`, `.js`, `.mjs`, and `.cjs`. The TypeScript-aware loader supports
extensionless relative helper imports. Use a default export, or `module.exports`
in `.cts`/`.cjs`. Multiple discovered configs require explicit selection:

```bash
pnpm exec kysoql generate --config config/kysoql.sandbox.ts
```

Explicit flags override config values, then built-in defaults apply. API version
uses `--api-version`, then config `apiVersion`, then the pinned `65.0` default. Versions are strings without `v`, such as `"65.0"`. Keep
runtime and generation versions aligned and check org support. The CLI now uses
native REST Describe; JSforce is neither used nor installed by codegen. Repeated
`--object` flags replace the configured list. Without a list (or with `objects:
[]`), generation includes every queryable object returned by Salesforce. When
`output` is omitted, codegen writes `src/kysoql/salesforce.generated.ts` if the
working directory has `src/`, otherwise `kysoql/salesforce.generated.ts`.
The default interface name remains `SalesforceSchema`.

The built-in default output is based on the working directory. A configured
relative `output` is resolved from the config file's directory; an explicit
`--output` is relative to the working directory. Absolute paths remain absolute.
`--no-config` skips
loading entirely and cannot be combined with `--config`.

Configuration and `--auth` modules execute code: only load trusted files. The CLI
does not read Salesforce access-token, instance-URL, or API-version environment
variables. Resolve a session explicitly with `@kysoql/auth`, your secret manager,
or another trusted provider. A config does not configure application runtime
clients. Use environment-specific auth providers and output files for multiple orgs.
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
  output: "src/kysoql/salesforce.generated.ts",
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
[field filtering guide](https://github.com/nktnet1/kysoql/blob/main/apps/docs/content/docs/codegen/field-filtering.mdx)
covers relationship dependencies, validation, and migration.

## Library API

The package exports `createRestDescribeClient`, `generateSchema`, `loadSchema`,
`renderSchema`, and normalized Salesforce Describe types for programmatic generation.

```ts
import { createRestDescribeClient, generateSchema } from "@kysoql/codegen";

export async function generateForOrg(instanceUrl: string, accessToken: string) {
  await generateSchema({
    client: createRestDescribeClient({ instanceUrl, accessToken, apiVersion: "65.0" }),
    objects: ["Account", "Contact"],
    output: "src/kysoql/salesforce.generated.ts",
  });
}
```

The factory also accepts a shared `RestClient` from `@kysoql/rest`, with renewable
token providers, fetch injection, cancellation, and timeout settings. It validates
global/object Describe responses, verifies returned object identity, and loads
complete Knowledge category trees with `topCategoriesOnly=false`. Failed taxonomy
requests can be retried by the caller. Existing custom `SalesforceDescribeClient`
implementations and field filtering remain supported.

Programmatic generation does not discover config files: pass options explicitly.
Its relative output paths continue to use the process working directory.


`generateSchema({ client, output, objects, fields })` uses the same
`ObjectFieldFilters` rules as the config. For a preview without writing a file,
pass them to `loadSchema(client, objects, fields)` and then call `renderSchema`.
`loadSchema` annotates filtered descriptions with `fieldsComplete: false`, and
`renderSchema` preserves that annotation in the generated object type.
