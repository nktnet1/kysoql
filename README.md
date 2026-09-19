# kysoql

A type-safe, Kysely-inspired SOQL query builder for TypeScript.

## Workspace

- `@kysoql/core` — typed SOQL AST, query builder, compiler, executor contract, and result inference.
- `@kysoql/jsforce` — JSforce authentication/execution adapter.
- `@kysoql/codegen` — CLI for generating strongly typed Salesforce schemas from Describe metadata.
- `@kysoql/debug` — minimal TypeScript runtime playground that logs query-builder ASTs.

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

It runs TypeScript typechecking, Vitest, and all package builds in fail-fast
order. Biome is intentionally separate so formatting can be run manually when
needed:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Vitest is configured at the workspace root and discovers tests under
`packages/**/tests/**/*.test.ts`. V8 coverage output is written to `coverage/`.

To inspect the query builder at runtime without connecting to Salesforce, run:

```bash
pnpm debug
```

The debug package is written in TypeScript. It builds `@kysoql/core`, compiles the
playground to an ignored `dist/` directory, then logs the immutable AST after
`selectFrom()`, `select()`, scalar and temporal `where()` calls, additive
`orderBy()` calls, `limit()`, the compiled SOQL, and a mock executor call made
by `.execute()`.

## Schema generation CLI

`@kysoql/codegen` uses oclif for command discovery, parsing, validation, and
generated help. Set the Salesforce connection environment variables, then run
the `generate` command:

```bash
export SF_INSTANCE_URL="https://example.my.salesforce.com"
export SF_ACCESS_TOKEN="..."

kysoql generate \
  --object Account \
  --object Contact \
  --output src/salesforce.generated.ts \
  --schema-name SalesforceSchema
```

`--object` is repeatable. If it is omitted, codegen includes every queryable
object returned by Salesforce. Run `kysoql --help` or
`kysoql generate --help` for the oclif-generated command reference.

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
emitting multiple `LIMIT` clauses.

Generated standard/custom metadata also enables typed `FIELDS(STANDARD)`,
`FIELDS(CUSTOM)`, and `FIELDS(ALL)` selections on root queries and relationship
subqueries. The selected row shape expands to the matching direct fields without
including relationship metadata. Kysoql rejects overlapping explicit selections;
because Salesforce treats `CUSTOM` and `ALL` as unbounded field groups in
REST/SOAP queries, those two selectors require `LIMIT 200` or less.

```ts
const accounts = await db
  .selectFrom("Account")
  .selectFields("all")
  .limit(200)
  .execute();
// SELECT FIELDS(ALL) FROM Account LIMIT 200
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
parent object must be present in the generated schema so its fields can be checked.

```ts
const records = await db
  .selectFrom("Kysoql_Record__c")
  .select(["Id", "Name", "Account__r.Id", "Account__r.Name"])
  .where("Account__r.Name", "like", "Kysoql Test %")
  .orderBy("Account__r.Name")
  .execute();
```

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
compiler validation layers.

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
on `Id`, `ExternalId`, or `ContentHubRepositoryId`. Kysoql validates those
requirements when compiling root queries, including aggregate and scalar
`COUNT()` forms. The normal field/operator type system remains unchanged.

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
`nextRecordsUrl`. Subquery `OFFSET` is intentionally not exposed because Salesforce
still documents it as a conditional pilot feature rather than a general
production child-query clause.

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

Grouped aggregate queries add `.groupBy(...)` before selecting ordinary result
fields. Grouping is restricted to generated `groupable` fields, grouped fields
can be added incrementally (including supported child-to-parent references), and
ordinary selected fields must already be present in the accumulated grouping set.
Grouped queries can also order by grouped sortable fields and use `LIMIT`.

```ts
const byStage = await db
  .selectFrom("Opportunity")
  .select(({ fn }) => fn.sum("Amount").as("totalAmount"))
  .groupBy("StageName")
  .select("StageName")
  .orderBy("StageName")
  .limit(20)
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
and `hourInDay()` are restricted to `datetime`. The exact function expression
must be accumulated through ordinary `groupBy(...)` before it can be selected,
used in `HAVING`, or used for ordering. Child-to-parent field references retain
their generated temporal checks and relationship nullability.

```ts
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
supports scalar `WHERE` filters and `LIMIT`, and the JSforce executor maps the
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

Execution stays transport-neutral in core. Configure the JSforce adapter to run
compiled SOQL through an existing JSforce connection:

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
```

The JSforce executor follows Salesforce pagination until the query result reports
`done`, so `.execute()` returns all fetched pages instead of silently stopping at
the first response.

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
seeds deterministic data, and verifies the fixture with a SOQL query. It refuses
to replace an existing org alias unless `--recreate` is explicitly supplied.

See [docs/salesforce-test-org.md](docs/salesforce-test-org.md) for prerequisites,
manual commands, script options, and cleanup instructions.

For future ChatGPT sessions continuing from a project bundle, read
[docs/chatgpt-handoff.md](docs/chatgpt-handoff.md) first. It records the package
boundaries, validation workflow, patch discipline, implemented surface, and next
incremental milestone.

## Design goals

- Kysely-like fluent query API.
- SOQL-native semantics instead of pretending Salesforce is SQL.
- Generated schemas for standard and custom objects/fields.
- Compile-time validation of fields, relationships, operators, grouping, sorting, and projections.
- JSforce used for Salesforce authentication and transport.
- No raw-string escape hatch in the safe API.

## Development continuity

- `docs/chatgpt-handoff.md` records the current incremental implementation state.
- `docs/research-notes.md` records external references and settled findings that are useful to future development sessions.
