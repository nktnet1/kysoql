# kysoql

A type-safe, Kysely-inspired SOQL query builder for TypeScript.

## Workspace

- [`@kysoql/core`](packages/core/README.md) — typed SOQL AST, query builder,
  compiler, executor contract, and result inference.
- [`@kysoql/rest`](packages/rest/README.md) - native REST query execution,
  pagination, async iteration, cancellation, and token-provider renewal.
- [`@kysoql/auth`](packages/auth/README.md) - Salesforce authentication with JWT bearer/private-key server-to-server as the default, plus supported OAuth flows and refresh-token storage.
- [`@kysoql/jsforce`](packages/jsforce/README.md) - optional execution adapter
  for applications with an existing JSforce connection.
- [`@kysoql/codegen`](packages/codegen/README.md) — CLI for generating strongly
  typed Salesforce schemas from Describe metadata.

## Requirements

- Node.js 26 (`package.json` enforces the Node 26 range; `.node-version` pins 26.8.2 for version managers that support it).
- pnpm 12.4.1.

Activate Node 26 using whichever version manager you prefer, then install:

```bash
node --version
pnpm install
```

## Development

Run the local validation gate with one command:

```bash
pnpm validate
```

It runs source TypeScript typechecking, test TypeScript typechecking, Vitest,
all package builds, and publish-shape verification in fail-fast order. The
publish check confirms that every declared package export, declaration file, and
CLI binary exists in the built output. The validation gate also verifies release
metadata, package-specific README files, version alignment, and the root
changelog. Biome is intentionally separate so
formatting can be run manually when needed:

```bash
pnpm check
pnpm check --write
pnpm typecheck
pnpm typecheck:source
pnpm typecheck:test
pnpm test
pnpm test:coverage
pnpm build
pnpm verify:publish
pnpm verify:release
```

Additional arguments passed to `pnpm check` are forwarded through Turborepo to
each package's Biome task, so `pnpm check --write` applies safe formatter, lint,
and import-organization fixes across the workspace. `pnpm verify:publish` expects
the packages to be built first; `pnpm validate` handles that ordering
automatically. `pnpm verify:release` can run independently because it checks
manifest/documentation metadata rather than build artifacts.

`pnpm typecheck:source` first runs the dependency-free task-configuration
regressions (`pnpm test:tasks`). Turbo then owns the dependency builds: package
source-typecheck scripts must not rebuild or clean another package's `dist/`.
A second core build can otherwise remove declarations while docs or another
consumer is reading them, even after a successful Turbo cache restore.

To check only the docs app with its build prerequisites:

```bash
pnpm exec turbo run typecheck:source --filter=docs
```

Vitest is configured at the workspace root and discovers tests under
`packages/**/tests/**/*.test.ts` plus `scripts/**/*.test.ts`. `pnpm typecheck:test`
checks those test files with their package-specific TypeScript configs and also
checks root test tooling plus the generated Salesforce fixture under `test/`.
V8 coverage output is written to `coverage/`.

The workspace pins TypeScript in `devDependencies`, and `.vscode/settings.json`
points VS Code at that installation. After the first `pnpm install`, select
**TypeScript: Select TypeScript Version** -> **Use Workspace Version** once for
the repository. Keeping the editor language service on the same TypeScript
version as `pnpm typecheck` prevents version-specific diagnostic placement from
turning valid negative `@ts-expect-error` assertions into editor-only errors.

## Schema generation CLI

`@kysoql/codegen` uses oclif for command discovery, parsing, validation, and
generated help. Configure an explicit authentication provider in
`kysoql.config.ts` (typically using `@kysoql/auth`), then run the `generate`
command:

```bash
kysoql generate \
  --object Account \
  --object Contact \
  --schema-name SalesforceSchema
```

`--object` is repeatable. If it is omitted, codegen includes every queryable
object returned by Salesforce. Output defaults to
`src/kysoql/salesforce.generated.ts` when the working directory has `src/`, or
`kysoql/salesforce.generated.ts` otherwise; `--output` and config `output` can
override it. Generated schemas retain the Describe metadata
used by the typed builder, including field capabilities, custom/polymorphic
reference metadata, supported scopes, MRU capability, and data-category metadata
when available. Generated imports are minimal, and empty metadata maps are
emitted as `Record<string, never>`. Generated field capabilities use named
metadata objects instead of positional booleans, and generated files are marked
`Do not edit manually`; regenerate them from Salesforce Describe metadata rather
than maintaining local edits. Run `kysoql --help` or `kysoql generate --help`
for the oclif-generated command reference.

## Current query surface

The core builder currently supports schema-checked selection, typed scalar
filtering, sortable-field-aware ordering, and validated result limits:

```ts
import { Kysoql, soqlDateTime } from "@kysoql/core";

const query = new Kysoql<SalesforceSchema>()
  .selectFrom("Account")
  .select(["Id", "Name", "AnnualRevenue", "LastModifiedDate"])
  .where("Name", "like", "Acme%")
  .where("AnnualRevenue", ">=", 100_000)
  .where(
    "LastModifiedDate",
    ">=",
    soqlDateTime("2026-01-01T00:00:00Z"),
  )
  .orderBy("AnnualRevenue", "desc")
  .orderBy("Name", "asc")
  .limit(25);

const compiled = query.compile();
// SELECT Id, Name, AnnualRevenue, LastModifiedDate FROM Account
// WHERE Name LIKE 'Acme%' AND AnnualRevenue >= 100000
// AND LastModifiedDate >= 2026-01-01T00:00:00Z
// ORDER BY AnnualRevenue DESC, Name ASC LIMIT 25
```

Kysely-style `$call(...)` and `$if(...)` composition is available on record,
aggregate, count, Apex, relationship-subquery, and semi-join builders. `$call`
passes the current specialised builder to a callback and returns the callback
result unchanged. `$if` invokes its callback only when the condition is true;
ordinary selections added inside `$if` become optional in the inferred result
shape. Structural SOQL modes must remain the same on both branches. Builders that
support `.where(...)` also support `.clearWhere()` to remove all accumulated
filters without mutating the earlier builder. The remaining Kysely-style clause
clearing helpers are also available where the corresponding SOQL clause is
modeled: `.clearOrderBy()`, `.clearLimit()`, `.clearOffset()`, `.clearSelect()`,
and aggregate `.clearGroupBy()`. Clearing selections resets the inferred output
before new selections are added. `clearGroupBy()` rejects cases where removing
the grouping would leave grouped-only SOQL state behind.

Selected fields, filterable fields, filter values, and operators are checked from
the generated Salesforce schema. Equality (`=`, `!=`), ordered comparisons
(`<`, `<=`, `>`, `>=`), and Kysely-style `like` are available where the field
type supports them. `.compile()` emits SOQL for the currently implemented scalar,
relationship-query, and semi/anti-join AST. `.orderBy(field,
direction?)` only accepts fields
whose generated Salesforce Describe metadata marks them `sortable: true`.
Calls are additive, and directions use Kysely-style lowercase `asc` / `desc`
while the compiler emits SOQL `ASC` / `DESC`. Omitting the direction uses
Salesforce's default ascending order. `.limit(n)` accepts non-negative safe
integers, including `0`; repeated calls replace the previous limit instead of
emitting multiple `LIMIT` clauses. Multi-currency fields also accept structured
`soqlCurrency("USD", 5000)` filter literals in `WHERE`; ISO-coded `IN` / `NOT IN`
lists are kept homogeneous with Salesforce's rule that they cannot be mixed with
bare numeric values.

Generated standard/custom metadata also enables typed `FIELDS(STANDARD)`,
`FIELDS(CUSTOM)`, and `FIELDS(ALL)` selections on root queries and relationship
subqueries. The selected row shape expands to the matching direct fields without
including relationship metadata. Kysoql rejects overlapping explicit selections.
Salesforce treats `CUSTOM` and `ALL` as unbounded field groups: API queries must
limit the result to at most 200 rows using `LIMIT`, `Id IN (...)`, or a boolean
combination of direct `Id = ...` tests. Apex supports only the bounded
`FIELDS(STANDARD)` selector and rejects `FIELDS(CUSTOM)` / `FIELDS(ALL)` even when
the query has a row limit. If generated metadata says an object has no custom
fields, `FIELDS(CUSTOM)` cannot be the complete field list; select another field
first if the selector is still required.

```ts
const accounts = await db
  .selectFrom("Account")
  .selectFields("all")
  .where("Id", "in", [accountId, secondAccountId])
  .execute();
// SELECT FIELDS(ALL) FROM Account WHERE Id IN ('...', '...')
```

Generated Salesforce `location` fields use a structured `{ latitude, longitude }`
value type and can participate in typed location-distance expressions without
being opened to ordinary scalar comparisons. `fn.geolocation(latitude,
longitude)` validates fixed coordinates, while `fn.distance(location, target,
"mi" | "km")` supports an aliased SELECT value, `<` / `>` filtering, and
distance ordering. When a fixed `GEOLOCATION()` is used, the location field is
kept as the first `DISTANCE()` argument. Location and relationship nullability
flow into the numeric distance result.

```ts
const nearbyAccounts = await db
  .selectFrom("Account")
  .select(["Id", "Office__c"])
  .select(({ fn }) =>
    fn
      .distance(
        "Office__c",
        fn.geolocation(-33.8688, 151.2093),
        "km",
      )
      .as("distanceFromSydney"),
  )
  .where((eb) =>
    eb(
      eb.fn.distance(
        "Office__c",
        eb.fn.geolocation(-33.8688, 151.2093),
        "km",
      ),
      "<",
      25,
    ),
  )
  .orderBy(({ fn }) =>
    fn.distance(
      "Office__c",
      fn.geolocation(-33.8688, 151.2093),
      "km",
    ),
  )
  .execute();
```

`GEOLOCATION()` is intentionally only exposed as a `DISTANCE()` argument. Direct
location equality, ordinary location ordering, aggregate/grouping use, and
non-`<`/`>` distance comparisons remain outside the typed query surface.

Translated picklist labels can be selected through an aliased `toLabel()`
callback. Inputs are restricted to generated `picklist` and `multipicklist`
fields, including child-to-parent paths, and translated outputs are inferred as
strings with source/relationship nullability preserved. Kysoql requires an alias
for every SELECT function result so the returned object key is deterministic.
Salesforce does not support ordering by `toLabel()` expressions, so they are not
accepted by `.orderBy()`.

```ts
const opportunities = await db
  .selectFrom("Opportunity")
  .select(["Id", "StageName"])
  .select(({ fn }) => fn.toLabel("StageName").as("stageLabel"))
  .execute();
```

Ordinary `WHERE` callbacks can also compare translated picklist labels. The
filter form accepts generated filterable `picklist` / `multipicklist` fields and
child-to-parent paths, compares against translated string labels rather than the
field's API-value union, and preserves nullable-field `null` comparisons.
Regular picklists expose equality and `LIKE`; multipicklists expose equality.
Salesforce's documented `WHERE` exclusions for `Division` and
`CurrencyIsoCode` are enforced statically, and external-object queries that use
`toLabel()` are rejected during query compilation.

```ts
const translatedOpportunities = await db
  .selectFrom("Opportunity")
  .select(["Id", "StageName"])
  .where((eb) => eb(eb.fn.toLabel("StageName"), "=", "Fermé gagné"))
  .execute();
```

Currency fields can be converted to the querying user's currency with an
aliased `convertCurrency()` selection. Inputs are restricted to generated
`currency` fields, including child-to-parent paths, and outputs remain numeric
with source/relationship nullability preserved. Salesforce requires multiple
currencies to be enabled for this function; that org-level setting is not part
of field Describe metadata, so kysoql cannot verify it statically. Salesforce
also disallows the function itself in `ORDER BY` (ordering by the currency field
uses its converted value).

```ts
const opportunities = await db
  .selectFrom("Opportunity")
  .select(["Id", "Amount"])
  .select(({ fn }) =>
    fn.convertCurrency("Amount").as("convertedAmount"),
  )
  .orderBy("Amount", "desc")
  .execute();
```

Localized number, currency, and temporal display values can be selected with an
aliased `format()` expression. Direct inputs are restricted to generated
`currency`, `double`, `int`, `percent`, `date`, `datetime`, and `time` fields,
including child-to-parent paths. Outputs are strings with source/relationship
nullability preserved. `format()` can also wrap an unaliased
`convertCurrency()` expression when the localized value should use the querying
user's currency. Aggregate queries can wrap unaliased field aggregates such as
`count(field)`, `sum(field)`, and `min(field)`; their aliases and nullable result
types remain explicit.

```ts
const opportunities = await db
  .selectFrom("Opportunity")
  .select("Id")
  .select(({ fn }) => [
    fn.format("CloseDate").as("localizedCloseDate"),
    fn
      .format(fn.convertCurrency("Amount"))
      .as("localizedConvertedAmount"),
  ])
  .execute();
```

```ts
const totals = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => [
    fn.format(fn.count("Id")).as("localizedCount"),
    fn.format(fn.sum("Amount")).as("localizedAmount"),
  ])
  .execute();
```

Generated parent-relationship metadata also enables typed child-to-parent dotted
paths in `.select()`, `.where()`, expression callbacks, and `.orderBy()`. The
terminal related field keeps its generated value/operator/capability checks, and
traversal is limited to Salesforce's five child-to-parent relationship levels.
Selected relationship fields infer the nested object shape returned by Salesforce,
including `null` when the generated lookup metadata is nullable. Every traversed
parent object must be present in the generated schema so its fields can be checked,
except for the polymorphic `.Type` qualifier described below.

```ts
const records = await db
  .selectFrom("Kysoql_Record__c")
  .select(["Id", "Name", "Account__r.Id", "Account__r.Name"])
  .where("Account__r.Name", "like", "Kysoql Test %")
  .orderBy("Account__r.Name")
  .execute();
```

Polymorphic parent relationships also expose Salesforce's virtual `.Type`
qualifier. Its selected value is inferred from the generated `referenceTo`
target union, while filters accept only those target names for equality/set
comparisons and ordinary string patterns for `LIKE`. The qualifier can be used
without generating every referenced target object because it depends only on the
polymorphic reference metadata.

```ts
const accountEvents = await db
  .selectFrom("Event")
  .select(["Id", "What.Type"])
  .where("What.Type", "in", ["Account", "Opportunity"])
  .where("What.Type", "like", "Acc%")
  .execute();
```

Kysoql exposes `.Type` only for references explicitly generated as polymorphic;
a multi-target reference without Salesforce's polymorphic metadata does not gain
the qualifier. The virtual field is selectable and filterable, but is not
synthesized as sortable, groupable, or aggregatable.

Generated polymorphic-reference metadata also enables typed `TYPEOF` selections.
Use the Salesforce relationship name such as `What` or `Who`, not the underlying
foreign-key field such as `WhatId`. Each `WHEN` branch is checked against its
referenced object, and the selected relationship is inferred as a union
discriminated by Salesforce's returned `attributes.type`. Parent relationship
paths such as `Event__r.What` preserve their generated nullability.

```ts
const events = await db
  .selectFrom("Event")
  .select(["Id", "Subject"])
  .selectTypeOf("What", (typeOf) =>
    typeOf
      .when("Account", ["Phone", "NumberOfEmployees"])
      .when("Opportunity", ["Amount", "CloseDate"])
      .else(["Name"]),
  )
  .execute();

for (const event of events) {
  if (event.What?.attributes.type === "Account") {
    console.log(event.What.Phone);
  }
}
```

Without `ELSE`, an unmatched polymorphic runtime type contributes `null` to the
selected relationship. Kysoql currently types `ELSE` conservatively: every
selected field must be valid across all remaining generated target objects rather
than modeling Salesforce's broader `Name` pseudo-object surface. Salesforce also
forbids combining `TYPEOF` with SELECT-function expressions, aggregate/grouping
forms, or selecting fields through the same polymorphic relationship in the
ordinary field list; kysoql enforces those boundaries at the typed API and
compiler validation layers. A `.Type` filter on that relationship remains valid,
so queries can combine `TYPEOF What ...` with `WHERE What.Type ...`.

Salesforce Describe `supportedScopes` metadata is generated per object. Root
queries can use `.usingScope(...)`, with the accepted value restricted to the
selected object's generated scope union rather than a global hard-coded list.
Repeated calls replace the previous scope, and the compiler emits the clause
immediately after `FROM`. Salesforce does not allow `USING SCOPE` inside
parent-to-child relationship subqueries, so the child-query builder intentionally
does not expose it.

```ts
const myAccounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .usingScope("mine")
  .where("Name", "like", "Acme%")
  .execute();
// SELECT Id, Name FROM Account USING SCOPE mine WHERE Name LIKE 'Acme%'
```

Generated data-category metadata enables typed root `WITH DATA CATEGORY` filters.
The category group and category names are constrained to the generated metadata for
the selected object, including non-empty multi-category lists. Each clause supports
Salesforce's `AT`, `ABOVE`, `BELOW`, and `ABOVE_OR_BELOW` selectors; a query can
have at most three conditions and cannot reuse the same category group. Knowledge
article queries (`KnowledgeArticleVersion` and `__kav` article types) are also
validated at compile time to require a root `WHERE` predicate on `PublishStatus` or
`Id`, as required by Salesforce.

```ts
const articles = await db
  .selectFrom("KnowledgeArticleVersion")
  .select(["Id", "Title"])
  .where("PublishStatus", "=", "Online")
  .withDataCategory("Geography__c", "at", ["usa__c", "france__c"])
  .withDataCategory("Product__c", "below", "mobile_phones__c")
  .execute();
// SELECT Id, Title FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online'
// WITH DATA CATEGORY Geography__c AT (usa__c, france__c)
// AND Product__c BELOW mobile_phones__c
```

The bundled codegen CLI loads the full visible Knowledge category tree through the
REST data-category resource for `KnowledgeArticleVersion` and `__kav` article
targets. Salesforce's REST resource exposes only categories visible to the
connected user and does not accept `Question`; the codegen client therefore keeps
category discovery optional so a SOAP-backed integration can supply Question
metadata without widening ordinary sObject Describe metadata. `WITH DATA CATEGORY`
is intentionally absent from relationship-subquery builders.

Salesforce API 48+ `WITH RecordVisibilityContext (...)` filtering is available on
root record, aggregate-result, and bare `COUNT()` builders through
`.withRecordVisibilityContext(...)`. The options are limited to Salesforce's three
documented parameters, at least one is required, and repeated calls replace the
previous context immutably. Because SOQL has one `WITH filteringExpression` slot,
RecordVisibilityContext cannot be combined with `WITH DATA CATEGORY`,
`WITH UserId`, or Apex access-mode `WITH` clauses. Relationship subqueries do not
expose it.

```ts
const visibleAccounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .withRecordVisibilityContext({
    maxDescriptorPerRecord: 100,
    supportsDomains: true,
    supportsDelegates: false,
  })
  .execute();
// SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%'
// WITH RecordVisibilityContext (maxDescriptorPerRecord=100,
// supportsDomains=true, supportsDelegates=false)
```

Data 360 objects get typed `SET OPTIONS` capability metadata from their generated
API names. Data Lake Objects (`__dll`) require a `dataspace` whenever
`.setOptions(...)` is used and can additionally set `honorEmptyStrings`; simple
Data Model Object (`__dlm`) record queries expose only `honorEmptyStrings`. The
compiler always emits `SET OPTIONS` at the end of the SOQL statement. DLO
aggregate-result and bare `COUNT()` builders also support the same typed options.

```ts
const lakeRows = await db
  .selectFrom("ContactPoint__dll")
  .select(["Id", "EmailOptIn__c"])
  .where("EmailOptIn__c", "=", "")
  .setOptions({ dataspace: "default", honorEmptyStrings: true })
  .execute();
// SELECT Id, EmailOptIn__c FROM ContactPoint__dll
// WHERE EmailOptIn__c = ''
// SET OPTIONS (dataspace='default', honorEmptyStrings=true)

const modelRows = await db
  .selectFrom("UnifiedIndividual__dlm")
  .select("Id")
  .setOptions({ honorEmptyStrings: true })
  .execute();
```

Managed-package dynamic Apex has a separate bound `SET OPTIONS` form. Use
`.dynamicApex()` plus a typed `Database.QueryOptions` marker when the Apex caller
will supply the actual option object. This remains compile-only and is distinct
from the existing static `.apex()` surface.

```ts
import {
  type ApexDatabaseQueryOptions,
  apexBind,
} from "@kysoql/core";

const managedDynamicQuery = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .dynamicApex()
  .setOptions(apexBind<ApexDatabaseQueryOptions>("queryOptions"))
  .compile();
// SELECT Id, Name FROM Account SET OPTIONS :queryOptions
```

Kysoql does not construct the Apex `Database.QueryOptions` instance or execute
the dynamic query; those remain responsibilities of the managed Apex caller.

Salesforce Describe also exposes each object's `mruEnabled` capability. Generated
schemas preserve that flag so root queries can use `.forView()` /
`.forReference()` only when the object is known to participate in Most Recently
Used tracking. Hand-written schemas that predate this metadata remain permissive.
Repeated calls replace the previous mode, and the compiler emits the clause after
`OFFSET`, matching Salesforce's top-level SELECT grammar. Relationship subqueries
intentionally omit both methods.

```ts
const viewedAccounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .limit(20)
  .forView()
  .execute();
// SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' LIMIT 20 FOR VIEW
```

Salesforce Knowledge article queries can also opt into search-keyword tracking
and article view statistics with `.updateTracking()` and `.updateViewstat()`.
These methods are only available for `KnowledgeArticleVersion` and specific
Knowledge article types ending in `__kav`; `Question` and ordinary sObjects are
excluded. The two modes accumulate rather than replace one another, and the
compiler emits the canonical `UPDATE TRACKING, VIEWSTAT` form after any
`FOR VIEW` / `FOR REFERENCE` clause. Relationship subqueries intentionally omit
both methods.

```ts
const article = await db
  .selectFrom("FAQ__kav")
  .select(["Id", "Title"])
  .where("PublishStatus", "=", "Online")
  .forView()
  .updateTracking()
  .updateViewstat()
  .execute();
// SELECT Id, Title FROM FAQ__kav WHERE PublishStatus = 'Online'
// FOR VIEW UPDATE TRACKING, VIEWSTAT
```

`UserProfileFeed` has a separate Salesforce query invariant: every query must
include `WITH UserId = ...`. Root builders expose `.withUserId(userId)` only for
that object, validate that the value is a non-empty string, and the compiler also
rejects unsafe/manual `UserProfileFeed` ASTs that omit the clause. Repeated calls
replace the previous user ID, and the clause is emitted after `WHERE` and before
grouping/ordering clauses.

```ts
const profileFeed = await db
  .selectFrom("UserProfileFeed")
  .select(["Id", "CreatedDate"])
  .withUserId("005D0000001AamR")
  .orderBy("CreatedDate", "desc")
  .limit(20)
  .execute();
// SELECT Id, CreatedDate FROM UserProfileFeed
// WITH UserId = '005D0000001AamR' ORDER BY CreatedDate DESC LIMIT 20
```

Relationship subqueries intentionally omit `.withUserId()`.

Salesforce also imposes required root filters on a small number of objects.
`ContentDocumentLink` queries must filter on `Id`,
`ContentDocumentId`, or `LinkedEntityId`; `ContentHubItem` queries must filter
on `Id`, `ExternalId`, or `ContentHubRepositoryId`. `Vote` is narrower: its
root `WHERE` must contain `ParentId = <single ID>`, `Parent.Type = <single
type>`, `Id = <single ID>`, or `Id IN (<ID list>)`. Kysoql validates those
requirements when compiling root queries, including aggregate and scalar
`COUNT()` forms. `UserRecordAccess` has a stricter coupled shape: exactly one
`UserId = ...` predicate plus either `RecordId = ...` or a literal `RecordId IN
(...)` list of at most 200 IDs. Its normal result form must select `RecordId`;
selected access fields / `MaxAccessLevel` are limited to Salesforce's documented
shape and must have matching `ORDER BY` entries, while an optional single
`Has*Access = TRUE` filter restricts the selection to `RecordId` only. Aggregate
and scalar `COUNT()` forms are rejected for this object. `NewsFeed` and
`UserProfileFeed` also reject `ORDER BY` references that traverse a parent
relationship; Salesforce allows ordering those feed queries only by root-object
fields. Permission-dependent feed row caps remain execution-context concerns rather
than unconditional compiler errors. The normal field/operator type system remains
unchanged.

Custom metadata types (`__mdt`) and external objects (`__x`) also receive the
unconditional SOQL limits Salesforce documents for those object families. Custom
metadata WHERE clauses are limited to the documented comparison/list operators,
`AND`, and same-field `OR` groups using `=` / `LIKE`; metadata relationship fields
remain valid in SELECT/WHERE, but relationship-field `ORDER BY` is rejected.
External objects reject the universal unsupported subset: `GROUP BY` / `HAVING`,
fielded `COUNT` plus `AVG` / `MIN` / `MAX` / `SUM`, `LIKE`,
`INCLUDES` / `EXCLUDES`, `toLabel()`, `TYPEOF`, `FOR VIEW` / `FOR REFERENCE`,
and `WITH` clauses. Bare `COUNT()` remains available; adapter-specific limits
(such as OData relationship ordering or custom-adapter location/scope behavior)
are intentionally left to execution context instead of being treated as universal.

Generated child-relationship metadata enables typed parent-to-child subqueries
without accepting arbitrary subquery `FROM` strings. `.selectSubquery()` takes a
generated child relationship name and a dedicated child-query builder with the
same scalar selection/filter/order/limit rules as the root query. Child queries
can also select child-to-parent paths and nest further child subqueries through
Salesforce's supported REST/SOAP relationship-query depth.

```ts
const accountsWithContacts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .selectSubquery("Contacts", (contacts) =>
    contacts
      .select(["Id", "LastName", "CreatedBy.Alias"])
      .where("LastName", "like", "A%")
      .orderBy("LastName")
      .limit(10),
  )
  .execute();
```

Each selected child relationship retains Salesforce's nested query-result shape:
the relationship value contains `totalSize`, `done`, `records`, and an optional
`nextRecordsUrl`. When executed through `@kysoql/rest`, selected relationship
continuations are followed automatically and recursively up to each child
subquery's `LIMIT`; applications do not manually fetch the locator. Salesforce
still documents relationship-subquery `OFFSET` as a
pilot that is not intended for production. Kysoql therefore keeps it off the
ordinary child-query surface and exposes it only through the explicit
`pilot.offset(...)` namespace. The immediate parent query must use a literal
`LIMIT 1`; the compiler revalidates that rule recursively for nested child queries.

```ts
const pilotPagedContacts = db
  .selectFrom("Account")
  .select("Id")
  .selectSubquery("Contacts", (contacts) =>
    contacts
      .select(["Id", "LastName"])
      .orderBy("LastName")
      .limit(20)
      .pilot.offset(20),
  )
  .limit(1);
```

Use `pilot.clearOffset()` to remove that pilot clause immutably. The normal
`contacts.offset(...)` method intentionally does not exist.

Compilation also enforces Salesforce's query-wide relationship cardinality limits:
no more than 20 parent-to-child relationships and 55 child-to-parent relationships.
Child-to-parent counting is path-aware, so repeated uses of `Owner` count once while
`Owner.Manager` adds a second relationship. Nested child-query scopes are counted
across the complete query, and explicit polymorphic `TYPEOF` targets consume the
additional relationship slots documented by Salesforce. When a root query is
constrained to one record by direct `Id = ...` equality, Salesforce collapses those
explicit polymorphic target counts; the compiler mirrors that exception.

`IN` and `NOT IN` also accept typed semi-join/anti-join subqueries when the left
operand is a direct ID/reference field. The subquery uses a dedicated builder so
it can select exactly one compatible ID/reference field and apply scalar filters
without exposing unsupported `ORDER BY`, `LIMIT`, nested semi-joins, or arbitrary
SOQL fragments. Existing scalar-list `IN` / `NOT IN` behavior is unchanged.

```ts
const accountsWithOpenOpportunities = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Id", "in", (subquery) =>
    subquery
      .selectFrom("Opportunity")
      .select("AccountId")
      .where("StageName", "!=", "Closed Lost"),
  )
  .execute();
```

The generated reference metadata is used to ensure the selected subquery field
identifies the same Salesforce object type as the outer ID/reference operand,
including polymorphic reference targets. Semi/anti-join subqueries remain
top-level `WHERE` terms, cannot be wrapped in `OR` / `NOT`, cannot query the same
object as the outer query, and are limited to two per query.

Aggregate selection starts from the same root builder with a Kysely-style
expression callback. Row-producing aggregate functions require explicit aliases,
so result keys are stable and typed instead of depending on Salesforce `exprN`
names. Generated Describe metadata carries each field's `aggregatable` capability;
`SUM` and `AVG` additionally accept only numeric Salesforce field types.

```ts
const totals = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => [
    fn.count("Id").as("opportunityCount"),
    fn.countDistinct("AccountId").as("accountCount"),
    fn.sum("Amount").as("totalAmount"),
    fn.avg("Amount").as("averageAmount"),
    fn.min("CloseDate").as("firstCloseDate"),
    fn.max("CloseDate").as("lastCloseDate"),
  ])
  .where("IsClosed", "=", false)
  .execute();
```

SOQL also permits ordinary `GROUP BY` without an aggregate function to return
the distinct grouped values, including `null`. Start grouping from the unselected
root builder, then select from the accumulated grouping set. This keeps the same
generated `groupable` checks and grouped result typing without forcing a dummy
aggregate selection.

```ts
const distinctStages = await db
  .selectFrom("Opportunity")
  .groupBy("StageName")
  .select("StageName")
  .orderBy("StageName")
  .execute();
```

Grouped queries add `.groupBy(...)` before selecting ordinary result fields.
Grouping is restricted to generated `groupable` fields, grouped fields can be
added incrementally, and ordinary selected fields must already be present in the
accumulated grouping set. Standard child-to-parent references such as
`Owner.Name` remain supported when their target field is groupable; Salesforce's
documented custom relationship-expression restriction means paths using `__r`
are rejected whenever the query uses `GROUP BY`. Grouped queries can also order
by grouped sortable fields and use `LIMIT` / `OFFSET`; `OFFSET` retains
Salesforce's `0..2000` bound and is available only after grouping on the
aggregate builder.

```ts
const byStage = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupBy("StageName")
  .select("StageName")
  .orderBy("StageName")
  .limit(20)
  .offset(20)
  .execute();
```

Grouped result sets can also order by unaliased row-producing aggregate
expressions, whether or not the expression is selected. The callback retains
the same generated `aggregatable` checks, including the numeric-only rules for
`sum()` and `avg()`, and supports direction plus explicit null placement. Bare
`count()` remains a scalar-only query form and cannot be used for ordering.

```ts
const largestStages = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupBy("StageName")
  .select("StageName")
  .orderBy(({ fn }) => fn.count("Id"), "desc")
  .orderBy(({ fn }) => fn.sum("Amount"), undefined, "last")
  .execute();
```

SOQL's complete date grouping family is available through the same `fn` module.
Date functions accept generated `date` or `datetime` fields, while `dayOnly()`
and `hourInDay()` are restricted to `datetime`. Normally the exact function
expression must be accumulated through ordinary `groupBy(...)` before it can be
selected, used in `HAVING`, or used for ordering. Salesforce has one SELECT-only
exception: when the function input is a generated `date` field, grouping by that
raw field also permits selecting date functions over it. The exception does not
apply to `datetime`, `ROLLUP` / `CUBE`, `HAVING`, or date-function ordering.
Child-to-parent field references retain their generated temporal checks and
relationship nullability.

The same date-function family is available directly in `WHERE` expression
callbacks. Filtering uses generated `filterable` metadata rather than requiring
the field to be `groupable`, and the comparison operand stays tied to the
function result (`number` for the numeric family and `soqlDate(...)` for
`dayOnly()`). `convertTimezone()` can be composed around filterable `datetime`
fields before applying the date function.

```ts
import { soqlDate } from "@kysoql/core";

const currentYearActivity = await db
  .selectFrom("Opportunity")
  .select(["Id", "Name"])
  .where((eb) =>
    eb.and([
      eb(eb.fn.calendarYear("CloseDate"), "=", 2026),
      eb(
        eb.fn.dayOnly(eb.fn.convertTimezone("CreatedDate")),
        ">=",
        soqlDate("2026-09-01"),
      ),
    ]),
  )
  .execute();
```

Salesforce's arithmetic `FORMULA()` predicate is currently a Beta service and is
documented only for `WHERE`. Kysoql keeps it visibly opt-in through
`eb.beta.formula(...)` rather than placing it on the ordinary `fn` namespace.
The formula body is structural: both operands must be generated filterable
`currency`, `double`, `int`, `date`, or `datetime` fields, and only `+` / `-` are
accepted. This avoids a raw formula-string escape hatch while preserving typed
numeric and temporal comparison values.

```ts
const highMargin = await db
  .selectFrom("Opportunity")
  .select(["Id", "Amount", "ExpectedRevenue"])
  .where((eb) =>
    eb(eb.beta.formula("Amount", "-", "ExpectedRevenue"), ">", 100),
  )
  .execute();
// SELECT Id, Amount, ExpectedRevenue FROM Opportunity
// WHERE FORMULA('Amount - ExpectedRevenue') > 100
```

The Beta helper is not exposed in SELECT or HAVING. Static and dynamic Apex
WHERE builders retain it and accept typed Apex binds on the comparison side. The
generic Salesforce scratch-org setup does not assume Beta enrollment.

```ts
const revenueByExactCloseDate = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.count("Id").as("opportunityCount"))
  .groupBy("CloseDate")
  .select(({ fn }) => fn.calendarYear("CloseDate").as("closeYear"))
  .execute();
// SELECT COUNT(Id) opportunityCount, CALENDAR_YEAR(CloseDate) closeYear
// FROM Opportunity GROUP BY CloseDate

const revenueByCloseYear = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupBy(({ fn }) => fn.calendarYear("CloseDate"))
  .select(({ fn }) => fn.calendarYear("CloseDate").as("closeYear"))
  .having((eb) => eb(eb.fn.calendarYear("CloseDate"), ">=", 2025))
  .orderBy(({ fn }) => fn.calendarYear("CloseDate"))
  .execute();
```

The numeric family comprises `calendarMonth`, `calendarQuarter`,
`calendarYear`, `dayInMonth`, `dayInWeek`, `dayInYear`, `fiscalMonth`,
`fiscalQuarter`, `fiscalYear`, `hourInDay`, `weekInMonth`, and `weekInYear`.
`dayOnly` returns the date portion as a string, matching Salesforce query-result
semantics. To group a `datetime` in the querying user's timezone, wrap the field
with `fn.convertTimezone(...)` inside the date function. The conversion cannot
be selected by itself, and its grouped identity is distinct from the same date
function over the unconverted UTC field.

```ts
const activityByLocalHour = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.count("Id").as("opportunityCount"))
  .groupBy(({ fn }) => fn.hourInDay(fn.convertTimezone("CreatedDate")))
  .select(({ fn }) =>
    fn.hourInDay(fn.convertTimezone("CreatedDate")).as("localHour"),
  )
  .orderBy(({ fn }) => fn.hourInDay(fn.convertTimezone("CreatedDate")))
  .execute();
```

Date function grouping is intentionally kept separate from the field-only
`ROLLUP` / `CUBE` and `GROUPING(field)` API.

For subtotal reports, aggregate builders also expose `.groupByRollup(...)` and
`.groupByCube(...)`. Both forms retain the same generated `groupable` checks,
can accumulate fields across calls, and enforce Salesforce's three-field limit.
Ordinary `GROUP BY`, `ROLLUP`, and `CUBE` forms cannot be mixed in one query.
Because advanced grouping adds subtotal and grand-total rows, selected grouping
fields are typed as nullable even when the underlying Salesforce field is not.

```ts
const pipeline = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupByRollup(["StageName", "Type"])
  .select(["StageName", "Type"])
  .select(({ fn }) => [
    fn.grouping("StageName").as("stageSubtotal"),
    fn.grouping("Type").as("typeSubtotal"),
  ])
  .having((eb) => eb(eb.fn.grouping("StageName"), "=", 0))
  .orderBy(({ fn }) => fn.grouping("Type"))
  .execute();
```

After `ROLLUP` or `CUBE` fields have been accumulated, `GROUPING(field)` is
available in `SELECT`, `HAVING`, and `ORDER BY` callbacks for exactly those
fields. Aliased selection results infer as `0 | 1`: `1` identifies a subtotal
for the field, while `0` identifies an ordinary grouped row. The function is not
exposed for ordinary `GROUP BY` queries.

Grouped aggregate queries also expose typed `HAVING`. Direct field operands must
already be grouped; aggregate operands use the same `fn` module without aliases.
The callback form supports `AND`, `OR`, and `NOT`, while semi/anti-join
subqueries remain unavailable in `HAVING`.

```ts
const significantStages = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => [
    fn.count("Id").as("opportunityCount"),
    fn.sum("Amount").as("totalAmount"),
  ])
  .groupBy("StageName")
  .select("StageName")
  .having((eb) =>
    eb.and([
      eb(eb.fn.count("Id"), ">", 5),
      eb(eb.fn.sum("Amount"), ">=", 100_000),
    ]),
  )
  .execute();
```

Bare `COUNT()` uses a dedicated scalar result builder because Salesforce returns
the count through the query-result count rather than an aggregate record. It
supports scalar `WHERE` filters and `LIMIT`, and both bundled executors map the
validated query result to a `number`.

```ts
const count = await db
  .selectFrom("Opportunity")
  .where("IsClosed", "=", false)
  .select(({ fn }) => fn.count())
  .execute();
```

Salesforce `date`, `datetime`, and `time` fields still infer as strings when
selected because that is how the generated API schema represents returned values.
Filters deliberately require `soqlDate(...)`, `soqlDateTime(...)`, or
`soqlTime(...)` instead of accepting plain strings. The factories validate the
Salesforce literal shape and the compiler emits those values unquoted, avoiding
the ambiguity between an ordinary SOQL string and a temporal literal.

## Native REST execution

Execution stays transport-neutral in core. Install `@kysoql/core` and
`@kysoql/rest` for the default native workflow, add `@kysoql/auth` when the
application should obtain or refresh Salesforce tokens itself, and use
`@kysoql/codegen` as a schema-generation development dependency. None of these
packages depends on JSforce. Runtime local imports below assume a TypeScript runner or bundler.

```ts
import { Kysoql } from "@kysoql/core";
import { createRestExecutor } from "@kysoql/rest";
import type { SalesforceSchema } from "./kysoql/salesforce.generated";

export function createDatabase(instanceUrl: string, accessToken: string) {
  const executor = createRestExecutor(
    { instanceUrl, accessToken, apiVersion: "65.0" },
    { maxPages: 100, maxRecords: 100_000 },
  );
  return { db: new Kysoql<SalesforceSchema>({ executor }), executor };
}
```

Build queries normally and call `.execute()` or `.executeAll()`. Both collect root
pages within the configured budgets and recursively complete selected relationship
subqueries. Root and child `LIMIT` clauses determine when each query level is
complete, so application code never needs to follow `nextRecordsUrl`.
`.executeAll()` enables Salesforce QueryAll rather than merely enabling pagination.
Bare `COUNT()` returns a number. For bounded-memory root processing, call
`executor.iterateQuery(query.compile())` or `queryPages(...)`. These also accept
QueryAll mode, abort signals, and timeouts. A failed budget throws instead of
silently truncating records.

The native API version is pinned to `65.0` unless explicitly configured. Token
providers can renew credentials once after `INVALID_SESSION_ID`.
`@kysoql/auth` exposes `SalesforceAuth` as the primary client API, with JWT
bearer/private-key server-to-server authentication as the default, plus current
Salesforce web-server/PKCE, refresh, client credentials, SAML, token
exchange, device, hybrid, and Experience Cloud headless flows. Refresh tokens can
use memory, browser `localStorage`, Redis, or custom persistence.
`@kysoql/rest` retains its original client-credentials and refresh helpers for
compatibility. Do not put secrets in config files. See the
[REST package](packages/rest/README.md) and
[authentication guide](apps/docs/content/docs/auth/index.mdx).

Codegen's CLI uses native REST Describe and accepts `--api-version` or config
`apiVersion`, then the pinned default. Authentication comes from config `auth` or
a trusted `--auth` provider module; codegen does not read Salesforce token/URL
environment variables. Runtime REST options
do not automatically load those CLI settings. A full monorepo installation still
includes the optional JSforce workspace and Salesforce CLI development tooling;
those are not dependencies of a native-only consumer application.

## Optional JSforce execution

Existing JSforce integrations remain supported without changing the adapter:


```ts
import { Kysoql } from "@kysoql/core";
import { createJsforceExecutor } from "@kysoql/jsforce";

const db = new Kysoql<SalesforceSchema>({
  executor: createJsforceExecutor(connection),
});

const accounts = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Name", "like", "Acme%")
  .execute();

const accountsIncludingDeleted = await db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .executeAll();
```

The JSforce executor follows Salesforce pagination until the query result reports
`done`, so `.execute()` returns all fetched pages instead of silently stopping at
the first response. `.executeAll()` uses Salesforce QueryAll semantics instead:
the first JSforce request sets `scanAll: true`, so soft-deleted records and
archived activities can be returned while subsequent `queryMore` pages preserve
the same QueryAll result set. The same execution mode is available on aggregate
queries and bare `COUNT()` queries.

## Salesforce test org

A reproducible scratch-org fixture is included under `test/salesforce`. It
contains standard Account/Contact data plus a `Kysoql_Record__c` custom object
with representative scalar, picklist, external-ID, and relationship fields.

For a complete local setup after authenticating or creating a Dev Hub, run:

```bash
pnpm salesforce:setup
```

The setup script installs from the lockfile, uses the workspace-local Salesforce
CLI via `pnpm sf`, creates a scratch org, deploys metadata, assigns permissions,
seeds deterministic data, and runs both the existing Salesforce smoke fixtures and
a generated-query E2E suite. The E2E suite uses a dedicated Vitest configuration:
it builds `@kysoql/core`, asserts exact SOQL compiled for representative record,
relationship, pagination, grouping, and aggregate queries, sends that SOQL to the
scratch org, and asserts deterministic returned values. It remains separate from
`pnpm test` and `pnpm validate` because it requires live Salesforce credentials.
The setup script refuses to replace an existing org alias unless `--recreate` is
explicitly supplied.

Re-run only the generated-query suite against an existing authenticated fixture
org with:

```bash
pnpm salesforce:e2e
# or
pnpm salesforce:e2e -- --target-org my-scratch-org
```

See [docs/salesforce-test-org.md](docs/salesforce-test-org.md) for prerequisites,
manual commands, script options, coverage boundaries, and cleanup instructions.

For future ChatGPT sessions continuing from a project bundle, read
[docs/chatgpt-handoff.md](docs/chatgpt-handoff.md) first. It records the package
boundaries, validation workflow, patch discipline, implemented surface, and next
incremental milestone.

## Design goals

- Kysely-like fluent query API.
- SOQL-native semantics instead of pretending Salesforce is SQL.
- Generated schemas for standard and custom objects/fields.
- Compile-time validation of fields, relationships, operators, grouping, sorting, and projections.
- Native REST execution and authentication helpers, with JSforce as an optional adapter.
- No raw-string escape hatch in the safe API.

## Development continuity

- `docs/chatgpt-handoff.md` records the current incremental implementation state.
- `docs/research-notes.md` records external references and settled findings that are useful to future development sessions.

## Apex compilation

Apex-only query syntax is separated from API execution. Build the normal query
first, then switch to the compile-only `.apex()` context. Row-producing record
queries can add locking clauses such as `FOR UPDATE`:

```ts
const lockedAccountQuery = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .where("Id", "=", accountId)
  .apex()
  .forUpdate()
  .compile();
```

Apex SOQL can also opt into deleted records and archived activities with
`.allRows()`. This is deliberately separate from API QueryAll execution:

```ts
const allAccounts = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .allRows()
  .compile();
// SELECT Id, Name FROM Account ALL ROWS
```

`ALL ROWS` is available on record, aggregate-result, and bare `COUNT()` Apex
queries. Salesforce does not allow it together with `FOR UPDATE`, and Kysoql
rejects that combination when compiling the query. Executable API queries
continue to use `.executeAll()` instead of compiling `ALL ROWS`.

The Apex-context builder intentionally has no `.execute()` or `.executeAll()`
method. It also exposes explicit access modes without guessing the Apex API
version's default security context:

```ts
const userModeQuery = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .withUserMode()
  .compile();

const systemModeQuery = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .withSystemMode()
  .compile();
```

Repeated access-mode calls replace the previous mode. `WITH USER_MODE` /
`WITH SYSTEM_MODE` cannot be combined with another SOQL `WITH` filtering form
such as `WITH DATA CATEGORY`. `FOR UPDATE` is also rejected if the underlying
query already contains `ORDER BY`.

Apex-only `WHERE` binds use `apexBind<T>(expression)` rather than embedding raw
SOQL. The generic describes the Apex value shape, while the helper accepts only a
simple identifier or a dotted member path such as `filters.accountName`:

```ts
import {
  apexAdd,
  apexBind,
  apexQueryField,
  apexSubstring,
} from "@kysoql/core";

const apexQuery = db
  .selectFrom("Account")
  .select(["Id", "Name"])
  .apex()
  .where((eb) =>
    eb.or([
      eb("Name", "=", apexBind<string>("accountName")),
      eb("Id", "in", apexBind<readonly string[]>("accountIds")),
    ]),
  )
  .limit(apexBind<number>("rowLimit"))
  .offset(apexBind<number>("rowOffset"))
  .compile();

// SELECT Id, Name FROM Account
// WHERE (Name = :accountName OR Id IN :accountIds)
// LIMIT :rowLimit OFFSET :rowOffset
```

For the documented static-Apex `+` expression family, use `apexAdd(...)` rather
than placing arithmetic text inside `apexBind(...)`. String operands concatenate,
number operands add, and either side can itself be another typed bind expression:

```ts
const composedBindQuery = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexAdd("x", "xx"))
  .limit(apexAdd(apexBind<number>("page.baseLimit"), 1))
  .compile();

// SELECT Id FROM Account
// WHERE Name = :('x' + 'xx')
// LIMIT :(page.baseLimit + 1)
```

For Salesforce's documented static-Apex string-expression form, use
`apexSubstring(value, beginIndex, endIndex)`. The receiver can be a string
literal or another string-valued Apex bind expression, while indexes are
validated as non-negative integers before the AST is created:

```ts
const substringBindQuery = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexSubstring("XXXX", 0, 3))
  .where(
    "Name",
    "like",
    apexAdd(apexSubstring(apexBind<string>("filters.name"), 0, 2), "%"),
  )
  .compile();

// SELECT Id FROM Account
// WHERE Name = :'XXXX'.substring(0, 3)
// AND Name LIKE :(filters.name.substring(0, 2) + '%')
```

Salesforce also documents a static-Apex bind whose expression is itself a query
result. Build that form with `apexQueryField(query, field)`. The nested query must be
a plain-mode Apex select builder and `field` must be one of its selected output keys,
so both the nested SOQL and the accessed value remain typed builder state rather than
raw Apex/SOQL text:

```ts
const sourceAccount = db
  .selectFrom("Account")
  .select("Name")
  .apex()
  .where("Id", "=", apexBind<string>("sourceAccount.Id"));

const queryResultBind = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where("Name", "=", apexQueryField(sourceAccount, "Name"))
  .compile();

// SELECT Id FROM Account
// WHERE Name = :[SELECT Name FROM Account WHERE Id = :sourceAccount.Id].Name
```

`apexQueryField(...)` models the query expression as a single-record result access,
matching Apex's bracket-query member-access semantics. Salesforce enforces that
cardinality at runtime: zero rows or more than one row can fail before the field is
read. Kysoql therefore does not silently add `LIMIT 1`; callers should constrain the
nested query according to their data model.

Salesforce static Apex also permits a bind expression on the left side of
`INCLUDES`. Kysoql exposes that as a separate Apex-only overload; the right side
remains a validated literal list rather than another bind:

```ts
const byBoundType = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .where(
    apexBind<string>("account.Type"),
    "includes",
    ["Customer - Direct; Customer - Channel"],
  )
  .compile();

// SELECT Id FROM Account
// WHERE :account.Type INCLUDES ('Customer - Direct; Customer - Channel')
```

Parent-to-child relationship subqueries can use the same typed `WHERE` binds,
but only after the root query has switched to the compile-only Apex context:

```ts
const accountsWithContacts = db
  .selectFrom("Account")
  .select("Id")
  .apex()
  .selectSubquery("Contacts", (contacts) =>
    contacts
      .select(["Id", "LastName"])
      .where("LastName", "like", apexBind<string>("filters.lastName")),
  )
  .compile();

// SELECT Id, (SELECT Id, LastName FROM Contacts
// WHERE LastName LIKE :filters.lastName) FROM Account
```

Scalar binds work with typed direct and child-to-parent relationship filters,
including temporal fields without converting the Apex expression into a SOQL
literal. Dotted member paths compile as expressions such as `:filters.accountName`. Raw
method calls, indexing, arithmetic text, whitespace, and other fragments remain
rejected by `apexBind(...)`; structured `+` expressions use `apexAdd(...)`, and
the documented `String.substring(beginIndex, endIndex)` family uses
`apexSubstring(...)` instead.
`apexAdd(...)` currently accepts string-with-string or number-with-number operands,
can nest, and can include existing typed bind expressions. `apexSubstring(...)`
returns a string-valued bind expression, accepts another string bind expression as
its receiver, and can therefore compose with `apexAdd(...)`. `apexQueryField(...)`
returns the selected nested-query field value type, accepts only plain-mode Apex
select builders, and stores the nested query as AST rather than raw SOQL text.
`IN` / `NOT IN` binds
represent collections, grouped Apex callbacks
support the same `and` / `or` / `not` composition as ordinary filters, and
`LIMIT` / `OFFSET` accept numeric binds. Literal pagination values retain the
normal Kysoql validation; a bound Apex value is validated by Salesforce when
the Apex query runs. Bind-left `INCLUDES` accepts a
string-valued `apexBind` plus literal strings, while Kysoql's field-left
`INCLUDES` / `EXCLUDES` form still does not accept an `apexBind` as its
right-hand value. KnowledgeArticleVersion / `__kav` Apex queries reject binds at
compilation. Ordinary REST/JSforce builders continue
to accept only escaped literal values and typed subqueries. Relationship
subqueries also keep Salesforce's existing no-semi-join restriction in Apex mode.

Aggregate-result and bare `COUNT()` queries can switch to the same compile-only
Apex context after their aggregate selection is built. They reuse typed Apex
`WHERE` binds, explicit `USER_MODE` / `SYSTEM_MODE`, and supported pagination
binds; aggregate queries retain `LIMIT` / `OFFSET`, while scalar `COUNT()` keeps
its existing `LIMIT`-only surface. `FOR UPDATE` remains available only on the
row-producing record Apex builder.

```ts
const apexTotal = db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .apex()
  .where("Amount", ">=", apexBind<number>("minimumAmount"))
  .withUserMode()
  .compile();

const apexCount = db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.count())
  .apex()
  .where("IsClosed", "=", apexBind<boolean>("isClosed"))
  .limit(apexBind<number>("rowLimit"))
  .compile();
```
