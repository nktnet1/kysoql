# @kysoql/core

`@kysoql/core` is the type-safe SOQL query builder at the heart of Kysoql. It gives you immutable, Kysely-inspired builders while following Salesforce query rules rather than SQL rules.

The package does not connect to Salesforce on its own. You can compile queries without a transport, or add `@kysoql/rest`, `@kysoql/jsforce`, or your own executor when you are ready to run them.

## Install

```bash
pnpm add @kysoql/core
```

Generate an org-specific schema with `@kysoql/codegen`, then pass it to `Kysoql`:

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

## Type-safe Salesforce queries

The generated schema gives Kysoql more than field names. It also carries Salesforce metadata such as nullability, filterability, sortability, grouping support, relationship targets, and active picklist values where available.

That lets the builder catch many mistakes before a query reaches Salesforce:

```ts
const accounts = db
  .selectFrom("Account")
  .select(["Id", "Name", "Owner.Name"])
  .where("Name", "like", "Acme%")
  .limit(25);
```

Result types follow the fields you actually select. Parent relationships retain their nested shape unless you give a field an alias.

```ts
const accounts = db
  .selectFrom("Account")
  .select(["Id as id", "Owner.Name as ownerName"]);
```

Salesforce does not provide ordinary field aliases for record queries, so Kysoql requests the source fields and projects the aliases onto the returned JavaScript rows.

## Compose queries without mutation

Builders are immutable. You can safely start with one query and derive several versions from it.

```ts
const base = db.selectFrom("Account").select(["Id", "Name"]);

const firstPage = base.orderBy("Name").limit(25);
const search = base.where("Name", "like", "Acme%").limit(10);
```

`$if` and `$call` help keep reusable query logic readable:

```ts
const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .$if(includeRevenue, (qb) => qb.select("AnnualRevenue"))
  .$call((qb) => addAccountFilters(qb));
```

Fields selected inside `$if` become optional in the inferred result because the condition is only known at runtime.

## Salesforce-specific features

Kysoql models Salesforce concepts directly instead of forcing them into SQL-shaped APIs. Core includes typed support for features such as:

- parent and child relationship queries
- semi-joins and anti-joins
- `TYPEOF` polymorphic selections
- aggregate queries, `HAVING`, `ROLLUP`, and `CUBE`
- Salesforce date and datetime literals
- `FIELDS()` selectors with Salesforce's bounding rules
- multipicklist `INCLUDES` and `EXCLUDES`
- translated labels, formatting, currency conversion, and geolocation functions
- QueryAll execution mode through capable executors
- Apex-only compilation with typed binds and access modes

Some Salesforce features are Beta or Pilot APIs. Kysoql keeps those APIs explicitly namespaced so experimental syntax is easy to spot in application code.

## Apex compilation

Use `.apex()` when the query is meant to be embedded in Apex and needs Apex-only syntax:

```ts
import { apexBind } from "@kysoql/core";

const query = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .where("Id", "=", apexBind<string>("accountId"))
  .forUpdate()
  .compile();
```

Apex builders are compile-only. Kysoql does not execute Apex or create the runtime bind values for you.

Use `.dynamicApex()` for the separate managed-package dynamic SOQL surface, including typed `Database.QueryOptions` binds.

## Execute queries

Pass a `QueryExecutor` to `Kysoql` to enable `.execute()`, `.executeTakeFirst()`, and related helpers.

For most applications, use [`@kysoql/rest`](https://nktnet1.github.io/kysoql/docs/rest). If you already have a JSforce connection, use [`@kysoql/jsforce`](https://nktnet1.github.io/kysoql/docs/jsforce).

```ts
const db = new Kysoql<SalesforceSchema>({ executor });

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .execute();
```

## Documentation

- [Framework guide](https://nktnet1.github.io/kysoql/docs/framework)
- [Core concepts](https://nktnet1.github.io/kysoql/docs/core)
- [Relationships](https://nktnet1.github.io/kysoql/docs/framework/guides/relationships)
- [Aggregates](https://nktnet1.github.io/kysoql/docs/framework/guides/aggregates)
- [Apex compilation](https://nktnet1.github.io/kysoql/docs/core/apex/overview)
- [Security and production use](https://nktnet1.github.io/kysoql/docs/core/reference/security)
- [API reference](https://nktnet1.github.io/kysoql/docs/core/reference/api)
