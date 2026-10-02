# kysoql

Kysoql is a type-safe query builder for Salesforce SOQL in TypeScript. Its API is inspired by [Kysely](https://kysely.dev/), with immutable fluent builders, inferred result types, and composable queries.

Kysoql is not a Kysely dialect or a SQL compatibility layer. Salesforce SOQL rules always win. Relationships use Salesforce paths and subqueries, values are escaped as SOQL literals, and SQL features that do not exist in SOQL are not exposed.

## Packages

| Package | Use it for |
| --- | --- |
| [`@kysoql/core`](packages/core/README.md) | Building and compiling typed SOQL queries |
| [`@kysoql/rest`](packages/rest/README.md) | Executing queries with Salesforce REST and native `fetch` |
| [`@kysoql/auth`](packages/auth/README.md) | Salesforce OAuth flows and refresh-token storage |
| [`@kysoql/codegen`](packages/codegen/README.md) | Generating org-specific schema types from Salesforce metadata |
| [`@kysoql/jsforce`](packages/jsforce/README.md) | Executing Kysoql queries through an existing JSforce connection |

Keep the `@kysoql/*` packages in an application on the same version.

## Quick start

Install the packages for a native REST setup:

```bash
pnpm add @kysoql/core @kysoql/rest @kysoql/auth
pnpm add -D @kysoql/codegen
```

Generate a schema for the Salesforce objects your application uses, then create a typed query builder:

```ts
import { Kysoql } from "@kysoql/core";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

const db = new Kysoql<SalesforceSchema>();

const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .orderBy("Name")
  .limit(25);

console.log(query.compile().soql);
// SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' ORDER BY Name LIMIT 25
```

Add an executor when you want to run the query against Salesforce. The [quickstart](https://nktnet1.github.io/kysoql/docs/framework/getting-started/quickstart) walks through authentication, schema generation, and REST execution end to end.

## Why generate a schema?

Salesforce orgs are different. Custom objects, custom fields, relationship names, picklist values, and field capabilities all depend on the org you connect to.

`@kysoql/codegen` reads Salesforce metadata and creates a TypeScript schema for that org. Kysoql uses the generated schema to catch mistakes while you write a query, including invalid field names, unsupported operators, incompatible relationship paths, and many clause combinations that Salesforce would otherwise reject later.

Generated types are still a development-time guardrail. Salesforce permissions, enabled features, API-version behaviour, query selectivity, and runtime limits continue to apply when the query executes.

## Kysely-inspired, Salesforce-native

If you already know Kysely, parts of Kysoql will feel familiar:

```ts
const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .$if(search.length > 0, (qb) => qb.where("Name", "like", `${search}%`))
  .orderBy("Name")
  .execute();
```

The similarities stop where Salesforce behaves differently. Kysoql models SOQL relationships, `TYPEOF`, aggregate queries, `FIELDS()`, QueryAll, Apex-only clauses, Salesforce date literals, multipicklists, and other platform-specific behaviour directly.

## Execution options

For most new applications, use `@kysoql/rest`. It uses native `fetch`, follows Salesforce query pagination, supports QueryAll and scalar counts, handles nested relationship continuations, and can renew access tokens through a provider.

If your application already owns a JSforce connection, use `@kysoql/jsforce` instead of creating a second transport stack.

Core query building stays transport-independent. You can also provide a custom executor when you need a different runtime or test transport.

## Apex compilation

Kysoql can compile SOQL for Apex without pretending that Apex and REST have the same rules. Switch to the Apex builder only when you need Apex-only syntax such as binds, `ALL ROWS`, access modes, or `FOR UPDATE`.

```ts
import { apexBind } from "@kysoql/core";

const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .where("Id", "=", apexBind<string>("accountId"))
  .compile();
```

Apex builders compile queries. They do not execute Apex for you.

## Documentation

The full documentation is available at [nktnet1.github.io/kysoql](https://nktnet1.github.io/kysoql/).

Good places to start:

- [Quickstart](https://nktnet1.github.io/kysoql/docs/framework/getting-started/quickstart)
- [Mental model](https://nktnet1.github.io/kysoql/docs/framework/guides/mental-model)
- [Selecting fields](https://nktnet1.github.io/kysoql/docs/framework/guides/selecting)
- [Filtering records](https://nktnet1.github.io/kysoql/docs/framework/guides/filtering)
- [Relationships](https://nktnet1.github.io/kysoql/docs/framework/guides/relationships)
- [Native REST execution](https://nktnet1.github.io/kysoql/docs/rest/execution)
- [Authentication](https://nktnet1.github.io/kysoql/docs/auth)
- [Schema generation](https://nktnet1.github.io/kysoql/docs/codegen/schema-generation)

## Development

The repository requires the Node.js version range in `package.json` and the pinned pnpm version from `packageManager`.

```bash
pnpm install
pnpm validate
```

`pnpm validate` runs the repository checks used before release, including formatting and linting, TypeScript checks, tests, package builds, publish-shape validation, and docs validation.

Useful focused commands include:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm verify:publish
```

Salesforce-backed E2E tests live under `tests/salesforce-e2e` and are separate from the normal test run because they require a configured Salesforce org. See [`scripts/README.md`](scripts/README.md) for repository automation and maintainer workflows.

## AI-assisted development

AI tools are used as part of developing the Kysoql packages, including code, tests, documentation, and review. AI-assisted changes are still reviewed and validated through the same repository checks before they are merged or released.

## Releases

Public packages are released together under the `@kysoql` npm scope. The release tooling validates package versions, tarballs, metadata, and consumer installs before publishing through npm trusted publishing.

Maintainers can inspect the available release commands with:

```bash
pnpm release --help
pnpm release:beta --help
```

## License

MIT
