# @kysoql/codegen

`@kysoql/codegen` turns Salesforce metadata into the TypeScript schema Kysoql uses for type-safe queries.

Generate the objects your application uses, commit or build the generated file according to your workflow, and regenerate it whenever the Salesforce schema changes.

## Install

```bash
pnpm add @kysoql/auth @kysoql/core
pnpm add -D @kysoql/codegen
```

Create `kysoql.config.ts` next to your application's `package.json`:

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

Then generate the schema:

```bash
pnpm exec kysoql generate
```

If your project has a `src` directory, the default output is `src/kysoql/salesforce.generated.ts`. Otherwise it is `kysoql/salesforce.generated.ts`.

## What gets generated

The generated TypeScript describes the Salesforce fields and relationships visible to the authenticated user. It also carries capabilities Kysoql needs for query validation, including filtering, sorting, grouping, aggregation, picklist values, relationship targets, and object-specific query features.

A generated field looks like this:

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

Generated files include a warning not to edit them by hand. Regenerate from Salesforce metadata instead.

## Configuration

The most common options are:

```ts
import { defineConfig } from "@kysoql/codegen";

export default defineConfig({
  auth: getSalesforceSession,
  apiVersion: "65.0",
  objects: ["Account", "Contact", "Opportunity"],
  output: "src/kysoql/salesforce.generated.ts",
  schemaName: "SalesforceSchema",
});
```

CLI flags override config values. Use an explicit config when a repository has more than one:

```bash
pnpm exec kysoql generate --config config/kysoql.sandbox.ts
```

You can also generate without a config:

```bash
pnpm exec kysoql generate --no-config \
  --auth config/salesforce.auth.ts \
  --object Account \
  --object Contact \
  --output src/kysoql/salesforce.generated.ts
```

Config and auth modules execute code, so only load files you trust.

## Generate fewer fields

Field rules are useful when a very large Salesforce object creates more generated metadata than your application needs:

```ts
export default defineConfig({
  objects: ["Account", "Contact", "User"],
  fields: {
    Account: { include: ["Id", "Name", "OwnerId"] },
    Contact: { exclude: ["Description"] },
  },
});
```

An object can have one `include` or `exclude` rule. Field names are exact and case-sensitive.

Keep fields used by selections, filters, sorting, grouping, lookups, and relationship paths. Codegen does not silently restore `Id` or relationship fields you filtered out.

Filtered objects cannot use typed `selectFields("standard" | "custom" | "all")` selectors because Salesforce could expand fields that are not present in the generated schema. Use explicit selections for those objects.

Field filtering only changes generated metadata. It is not a Salesforce security boundary.

## Big Objects

Custom Big Objects ending in `__b` do not support ordinary REST Describe. When you explicitly include one, codegen reads the metadata it needs through Salesforce Tooling API instead.

The generated schema includes ordered Big Object index metadata so Kysoql can validate the required leading index filters when you build a query.

## Library API

You can run generation from application tooling instead of the CLI:

```ts
import { createRestDescribeClient, generateSchema } from "@kysoql/codegen";

await generateSchema({
  client: createRestDescribeClient({
    instanceUrl,
    accessToken,
    apiVersion: "65.0",
  }),
  objects: ["Account", "Contact"],
  output: "src/kysoql/salesforce.generated.ts",
});
```

The library API also exposes metadata loading and rendering helpers for custom generation workflows.

## Documentation

- [Codegen overview](https://nktnet1.github.io/kysoql/docs/codegen)
- [Schema generation](https://nktnet1.github.io/kysoql/docs/codegen/schema-generation)
- [Configuration](https://nktnet1.github.io/kysoql/docs/codegen/configuration)
- [Field filtering](https://nktnet1.github.io/kysoql/docs/codegen/field-filtering)
- [API reference](https://nktnet1.github.io/kysoql/docs/codegen/api)
