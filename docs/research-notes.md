# Research notes

This file records external references that materially shaped kysoql. It is intentionally concise: use it to avoid repeating settled research, but re-check a source when implementing behavior that depends on a current API or Salesforce rule.

## Kysely architecture

### Query execution

Source: https://github.com/kysely-org/kysely/blob/master/src/raw-builder/raw-builder.ts

Useful findings:

- Kysely keeps query construction, compilation, and execution separate.
- `execute()` obtains a query executor, compiles the immutable operation node, then delegates execution to `executor.executeQuery(...)`.
- The output type remains a type parameter carried through the compiled query and executor.

Planned kysoql consequence: keep execution transport-neutral in `@kysoql/core`; JSforce should remain an adapter rather than a dependency of core.


### Select builder and immutable AST

Sources:

- https://github.com/kysely-org/kysely/blob/master/src/query-creator.ts
- https://github.com/kysely-org/kysely/blob/master/src/query-builder/select-query-builder.ts
- https://github.com/kysely-org/kysely/blob/master/src/operation-node/query-node.ts
- https://github.com/kysely-org/kysely/blob/master/src/parser/select-parser.ts

Useful findings:

- `selectFrom()` creates a select builder around an immutable operation node.
- Builder methods clone the underlying node instead of mutating previous builders.
- Kysely accumulates selected output through the `O & Selection<...>` pattern.
- Repeated `where()` calls are represented by query-node cloning and boolean operation nodes.

Kysoql consequence: preserve immutable builders, additive selected-output typing, and AST/compiler separation where those concepts map cleanly to SOQL.

### ORDER BY builder shape

Source: https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html

Re-checked on 2026-09-17 while implementing typed ordering.

Useful findings:

- Kysely exposes `orderBy(expression, direction?)` with lowercase `asc` / `desc` directions.
- Repeated `orderBy()` calls are additive and preserve call order.
- Omitting a direction leaves the database's default ascending ordering in effect.

Implemented consequence: `v1.0.18` introduced the narrow field-only
`orderBy(field, direction?)` form, and `v1.0.34` added explicit lowercase
`first` / `last` null placement that compiles to `NULLS FIRST` / `NULLS LAST`.
Raw expressions, callbacks, and aliases are still intentionally absent.

### General project architecture

Source: https://github.com/kysely-org/kysely

Useful finding: Kysely models visible tables/columns in TypeScript and uses immutable builders. Kysoql follows that pattern where it maps to SOQL, but does not copy SQL-only concepts such as arbitrary joins.

## JSforce

### Connection and query API

Sources:

- https://jsforce.github.io/jsforce/classes/connection.Connection.html
- https://jsforce.github.io/jsforce/classes/query.Query.html
- https://jsforce.github.io/jsforce/modules/query.html

Re-checked against the JSforce v3 API reference on 2026-09-17 while implementing
the first execution adapter.

Useful findings:

- `Connection.query<T>(soql)` returns a thenable `Query` object.
- The default raw-query response target is a query result containing `records`, `done`, and optionally `nextRecordsUrl`.
- `Connection.queryMore<T>(locator)` continues a paginated query.
- Query objects also support `autoFetch`, but it is bounded by `maxFetch`; Kysoql execution therefore follows `nextRecordsUrl` explicitly rather than relying on a silent fetch cap.

Implemented consequence in `v1.0.16`: `@kysoql/jsforce` starts with
`Connection.query(...)`, accumulates `records`, and repeatedly calls
`queryMore(nextRecordsUrl)` until `done` is true. An incomplete response with
`done: false` but no `nextRecordsUrl` is treated as an error instead of a partial
success.

### Older JSforce query documentation

Source: https://jsforce.github.io/document/

Useful finding: Salesforce query results can exceed a single response page. JSforce supports automatic fetching, but its documented default `maxFetch` is finite. This supports explicit pagination if kysoql's future `.execute()` returns the complete result as an array.

## JSforce schema typing and Describe

Sources:

- https://jsforce.github.io/blog/posts/20191216-jsforce20-alpha-preview-with-schema-type-feature.html
- https://jsforce.github.io/jsforce/classes/connection.Connection.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html

Useful findings:

- JSforce supports schema-parameterized connections and generated types for standard and custom objects.
- Raw `Connection.query()` still accepts SOQL strings, so its generic result type does not validate the SOQL text itself.
- Salesforce Describe metadata exposes fields, relationships, and capabilities needed by kysoql codegen.

Kysoql consequence: use JSforce for authentication/Describe/transport, but keep the schema generator and type-safe SOQL AST/compiler owned by kysoql.

## Salesforce SOQL

### String escaping

Source: https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-reservedcharacters.html

Useful findings:

- SOQL quoted strings escape single quotes and backslashes with backslashes.
- `LIKE` uses `%` and `_` wildcards, and a backslash can escape those wildcard characters.

Kysoql consequence: the compiler escapes string literals itself and preserves caller-provided `\\%` / `\\_` LIKE escapes.

### Comparison operators and conditions

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-conditionexpression.html

Useful findings:

- SOQL supports equality and ordered comparison operators plus `LIKE`.
- Boolean literals are emitted as `TRUE` / `FALSE`; `null` is a keyword.
- Operator validity depends on Salesforce field types, so kysoql constrains operators using generated Describe metadata rather than JavaScript value types alone.

### Date/time formats

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-dateformats.html
- https://developer.salesforce.com/docs/platform/change-data-capture/guide/cdc-filter-considerations.html
- https://help.salesforce.com/s/articleView?id=platform.custom_field_time_overview.htm&language=en_US&type=5
- https://help.salesforce.com/s/issue?id=a028c00000gAwC9AAK&language=en_US

Re-checked on 2026-09-17 while implementing explicit temporal literals.

Useful findings:

- SOQL `date` values use unquoted `YYYY-MM-DD`. Salesforce documents the valid
  date range as years 1700 through 4000.
- SOQL `dateTime` values use an unquoted `YYYY-MM-DDThh:mm:ss` value followed by
  `Z` or an explicit `+/-hh:mm` UTC offset. Salesforce-owned SOQL examples also
  show three-digit milliseconds before the zone/offset.
- Time fields require a trailing `Z`. Salesforce Help shows SOQL/API time values
  such as `07:00:00.000Z`; CDC filter guidance also documents the seconds-only
  `hh:mm:ssZ` form.
- Returned temporal field values are strings in the generated TypeScript schema,
  but passing those strings directly to a safe filter would make the compiler
  indistinguishable from an ordinary quoted SOQL string.

Implemented consequence in `v1.0.17`: core exposes branded `soqlDate(...)`,
`soqlDateTime(...)`, and `soqlTime(...)` factories. They validate calendar/time
components, timezone-offset bounds where relevant, and accepted literal shapes.
The filter type maps generated Salesforce `date`, `datetime`, and `time` fields
to the matching wrapper while leaving selected result values as strings. The
compiler recognizes only those explicit wrappers and emits their values unquoted.
Implemented consequence in `v1.0.41`: core adds a separate branded
`soqlRelativeDate(...)` wrapper for the fixed `TODAY`, `YESTERDAY`, and
`TOMORROW` literals. Those values are accepted only for Salesforce `date` /
`datetime` filters and compile unquoted.

Implemented consequence in `v1.0.42`: the same factory supports the first
parameterized family via `soqlRelativeDate("LAST_N_DAYS", n)` and
`soqlRelativeDate("NEXT_N_DAYS", n)`. The count is validated as a non-negative
safe integer and the resulting `LAST_N_DAYS:n` / `NEXT_N_DAYS:n` literal remains
inside the branded relative-date representation. Callers cannot pass the
colon-delimited form directly as an ordinary string.

Implemented consequence in `v1.0.43`: the same parameterized factory path also
supports `soqlRelativeDate("LAST_N_MONTHS", n)` and
`soqlRelativeDate("NEXT_N_MONTHS", n)`, reusing the same non-negative
safe-integer count validation and branded unquoted literal representation.

Implemented consequence in `v1.0.44`: the fixed-literal path also supports
`LAST_MONTH`, `THIS_MONTH`, and `NEXT_MONTH`. They remain branded relative-date
values, are valid only for Salesforce `date` / `datetime` filters, and compile
unquoted through the existing relative-date compiler path.

Implemented consequence in `v1.0.45`: the same fixed-literal path also supports
`LAST_QUARTER`, `THIS_QUARTER`, and `NEXT_QUARTER`, with the same date/datetime
filter restriction and unquoted compiler behavior.

Implemented consequence in `v1.0.46`: the same fixed-literal path also supports
`LAST_YEAR`, `THIS_YEAR`, and `NEXT_YEAR`, with the same date/datetime filter
restriction and unquoted compiler behavior.

Implemented consequence in `v1.0.47`: the same fixed-literal path also supports
`LAST_FISCAL_YEAR`, `THIS_FISCAL_YEAR`, and `NEXT_FISCAL_YEAR`, with the same
date/datetime filter restriction and unquoted compiler behavior.

Implemented consequence in `v1.0.48`: the same fixed-literal path also supports
`LAST_FISCAL_QUARTER`, `THIS_FISCAL_QUARTER`, and `NEXT_FISCAL_QUARTER`, with
the same date/datetime filter restriction and unquoted compiler behavior.

Implemented consequence in `v1.0.49`: the parameterized factory path also supports
`soqlRelativeDate("LAST_N_FISCAL_QUARTERS", n)` and
`soqlRelativeDate("NEXT_N_FISCAL_QUARTERS", n)`, reusing the same non-negative
safe-integer count validation and branded unquoted literal representation.

Implemented consequence in `v1.0.50`: the parameterized factory path also supports
`soqlRelativeDate("LAST_N_FISCAL_YEARS", n)` and
`soqlRelativeDate("NEXT_N_FISCAL_YEARS", n)`, reusing the same non-negative
safe-integer count validation and branded unquoted literal representation.

Implemented consequence in `v1.0.51`: relative-date support is completed as one
grouped slice. The fixed path adds `LAST_WEEK`, `THIS_WEEK`, `NEXT_WEEK`,
`LAST_90_DAYS`, and `NEXT_90_DAYS`. The parameterized path adds
`N_DAYS_AGO:n`; `LAST_N_WEEKS:n`, `NEXT_N_WEEKS:n`, `N_WEEKS_AGO:n`;
`N_MONTHS_AGO:n`; `LAST_N_QUARTERS:n`, `NEXT_N_QUARTERS:n`,
`N_QUARTERS_AGO:n`; `LAST_N_YEARS:n`, `NEXT_N_YEARS:n`, `N_YEARS_AGO:n`;
and the fiscal `N_FISCAL_QUARTERS_AGO:n` / `N_FISCAL_YEARS_AGO:n` forms. All
parameterized forms reuse the same non-negative safe-integer validation and all
relative-date values remain branded and compile unquoted. Wrapper revalidation
now checks the family against the canonical family list rather than duplicating
the list in a second regular expression.

### ORDER BY

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-examples.html

Re-checked on 2026-09-17 while implementing typed ordering.

Useful findings:

- SOQL supports multiple ordered fields in one `ORDER BY` clause.
- `ASC` and `DESC` select ascending and descending order; ascending is the default
  when no direction is supplied.
- Salesforce excludes some field types from sorting, while generated Describe
  metadata already exposes each field's `sortable` capability.
- `NULLS FIRST` / `NULLS LAST` are separate modifiers from the direction.

Implemented consequence: only fields whose generated schema metadata has
`sortable: true` are accepted by `orderBy()`. The AST accumulates order items
immutably, explicit lowercase builder directions compile to uppercase SOQL
`ASC` / `DESC`, and `v1.0.34` added optional null placement that compiles to
`NULLS FIRST` / `NULLS LAST`.

### LIMIT

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html
- https://trailhead.salesforce.com/content/learn/modules/apex_database/apex_database_soql

Re-checked on 2026-09-18 while implementing typed limits.

Useful findings:

- SOQL `LIMIT` is an optional `SELECT` clause that specifies the maximum number
  of rows to return. Salesforce describes the requested count as arbitrary and
  does not document a general SOQL `LIMIT` maximum analogous to the 2,000-row
  `OFFSET` cap or the separate SOSL result cap.
- `LIMIT` belongs after `ORDER BY` in the supported top-level query shape.
- The safe builder only needs integer row counts. Kysoql accepts non-negative
  safe integers, including `0`, and rejects negative, fractional, non-finite,
  and unsafe JavaScript numbers before they reach the compiler.

Implemented consequence in `v1.0.19`: `SelectQueryBuilder.limit(number)` stores
a frozen `LimitNode`; a later call replaces the earlier node, and the compiler
emits exactly one `LIMIT n` clause after `WHERE` / `ORDER BY`. No arbitrary upper
bound is invented in core.

### Relationships

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-limits.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-results.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-lookup.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html

Useful findings:

- SOQL uses declared Salesforce relationships rather than arbitrary SQL joins.
- Child-to-parent traversal uses dotted relationship paths; each path can traverse
  at most five child-to-parent relationship levels.
- Parent-to-child traversal uses nested `SELECT` subqueries whose `FROM` member is
  the generated child relationship name, not necessarily the child object name.
- In API version 58.0 and later, REST/SOAP/Apex query calls can return five total
  parent-to-child levels: the root is level one and child relationships can nest
  four levels beneath it. Salesforce allows at most 20 parent-to-child
  relationships in one query.
- Relationship query results are nested objects. Nullable lookup relationships can
  produce a null parent while the driving record is still returned. A selected
  parent-to-child relationship contains its own query-result envelope with record
  metadata plus the nested `records` array.
- Child relationship subqueries support scalar `WHERE`, `ORDER BY`, and `LIMIT`
  clauses. `OFFSET` in most subqueries remains disallowed; Salesforce documents a
  conditional subquery `OFFSET` form as a pilot feature when the parent query uses
  `LIMIT 1`, so kysoql should not expose it as a normal production clause.

Implemented consequence in `v1.0.52`: child-to-parent references are validated
lazily from generated parent metadata instead of eagerly expanding every possible
path. Related selections infer nested result objects with relationship nullability,
and related filters/orderings reuse the terminal field's generated metadata. A
traversed parent object must be present in the generated schema so its fields can
be checked. No arbitrary SQL joins are exposed.

Implemented consequence in `v1.0.53`: `.selectSubquery(relationship, callback)`
validates the relationship lazily from generated `children` metadata and creates a
dedicated immutable relationship-subquery AST/builder. Child subqueries reuse typed
field selection, scalar filters/expression callbacks, ordering, and limits; they
can select child-to-parent paths and nest parent-to-child subqueries through four
child traversals below the root. Selected child relationships infer
`SalesforceQueryResult<Row>` with `totalSize`, `done`, `records`, and optional
`nextRecordsUrl`. Subquery `OFFSET`, aggregates, and raw SOQL fragments remain
outside this slice.

### Semi-joins and anti-joins

Source re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html

Useful findings:

- `IN` and `NOT IN` can replace a scalar value list with a subquery to form a
  semi-join or anti-join. The outer left operand must be one direct ID or
  reference field; relationship traversal such as `Account.Id` is not allowed.
- The subquery selects exactly one compatible ID/reference field. Its selected
  field cannot use dot notation, and the subquery cannot query the same object as
  the outer query. Reference fields can support parent-to-child, child-to-parent,
  child-to-child, and polymorphic-reference cases when the referenced object type
  is compatible.
- At most two semi/anti-join subqueries can participate in one query. They cannot
  be nested in another semi/anti-join, used inside a relationship-subquery `WHERE`,
  combined through `OR`, or wrapped with logical `NOT`. Use `NOT IN` for the
  anti-join form instead of negating an `IN` subquery.
- Semi/anti-join subqueries do not support `COUNT`, `FOR UPDATE`, `ORDER BY`, or
  `LIMIT`. Salesforce also excludes ActivityHistory, Attachments, Event, Note,
  OpenActivity, tag objects, and Task from this subquery position.

Implemented consequence in `v1.0.55`: scalar-list `IN` / `NOT IN` remain
unchanged, while ID/reference operands can now take a typed subquery factory such
as `where("Id", "in", q => q.selectFrom("Opportunity").select("AccountId"))`.
A dedicated frozen `SemiJoinSubqueryNode` and builder expose exactly one compatible
ID/reference selection plus scalar filtering. Generated `referenceTo` metadata is
used to compare the object-ID domains of the outer and selected fields, including
polymorphic references. The outer object and known unsupported subquery objects
are excluded, relationship-subquery filters disable semi/anti-joins, expression
wrappers track whether they contain a semi/anti-join so `OR` / `NOT` reject them,
and the top-level builder enforces Salesforce's two-subquery limit.

### Aggregate query selection foundation

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-agg-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-agg-functions-field-types.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-count.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-alias.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html

Useful findings:

- Salesforce supports `COUNT()`, `COUNT(field)`, `COUNT_DISTINCT(field)`,
  `SUM(field)`, `AVG(field)`, `MIN(field)`, and `MAX(field)`. `SUM` and `AVG`
  apply to numeric field families, while the broader aggregate functions still
  depend on the field's Describe aggregate capability.
- Aggregate expressions can be followed directly by an alias (without SQL
  `AS`). Without an explicit alias, Salesforce generates `exprN` keys for
  aggregate result records, so the safe builder should require aliases whenever
  a row-producing aggregate expression is selected.
- `COUNT()` is a special query form: it is selected by itself and the query
  result reports the count directly rather than returning an `AggregateResult`
  row. Salesforce documents `LIMIT` for this form but not `ORDER BY`; normal
  aggregate queries without `GROUP BY` cannot use `LIMIT`.
- Aggregate functions other than bare `COUNT()` return aggregate result records.
  Aggregate functions generally ignore null field values; `MIN`/`MAX`/`SUM`/`AVG`
  therefore still need nullable result typing for empty/all-null input sets.

Implemented consequence in `v1.0.57`: generated field metadata now preserves
Describe's `aggregatable` flag. Root `.select(({ fn }) => ...)` can enter a
dedicated aggregate mode with explicitly aliased `COUNT(field)`,
`COUNT_DISTINCT`, `SUM`, `AVG`, `MIN`, and `MAX` expressions and typed output
keys/values. `SUM`/`AVG` additionally require numeric Salesforce field types.
Bare `COUNT()` transitions to a scalar `CountQueryBuilder`; core's executor
contract has an optional count method for backward structural compatibility, and
the JSforce adapter implements it from a validated `totalSize` result.

### Basic GROUP BY

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-group-by-considerations.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html

Useful findings:

- A grouped aggregate query must include every non-aggregate selected field in its
  `GROUP BY` field list. Multiple grouping fields are comma-separated and their
  order is significant to the emitted query.
- Describe exposes a `groupable` boolean for determining whether a field can be
  placed in `GROUP BY`; formula and other unsupported field forms must remain
  excluded by generated metadata.
- Aggregate queries can use `LIMIT` when `GROUP BY` is present, while aggregate
  queries without grouping cannot use `LIMIT`.

Implemented consequence in `v1.0.58`: aggregate mode now exposes additive typed
`.groupBy(...)` calls restricted to generated `groupable: true` field references.
After grouping, ordinary `.select(...)` fields must be members of the accumulated
grouping set and contribute their normal nested selection shape to the aggregate
result type. Grouped aggregate queries can order by grouped sortable fields and
use `LIMIT`. The immutable `GroupByNode` compiles between `WHERE` and `ORDER BY`.

### HAVING

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-having.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-examples.html

Useful findings:

- `HAVING` filters grouped aggregate results and therefore requires `GROUP BY`.
  It compiles after `GROUP BY` and before `ORDER BY`.
- `HAVING` conditional expressions can compare aggregate functions and grouped
  field references. A non-aggregate field referenced by `HAVING` must be present
  in the `GROUP BY` list.
- The clause supports comparison conditions combined with logical `AND`, `OR`,
  and `NOT`, similarly to `WHERE`.
- Salesforce explicitly disallows semi-join and anti-join subqueries inside
  `HAVING`.

Implemented consequence in `v1.0.59`: grouped aggregate builders expose additive
typed `.having(...)`. Direct field operands are restricted to the accumulated
`GROUP BY` set. The callback form exposes the existing aggregate `fn` module for
unaliased aggregate operands and typed logical `and` / `or` / `not` composition.
Aggregate comparison values/operators retain the originating field semantics for
`MIN` / `MAX`, while numeric aggregate functions use numeric comparisons. A
dedicated immutable `HavingNode` compiles in SOQL clause order, and HAVING field
parsing disables semi/anti-join operands at both the type and runtime boundaries.
`ROLLUP`, `CUBE`, `GROUPING()`, date grouping functions, and ordering by aggregate
expressions remain separate follow-up work.

### Remaining SOQL surface / roadmap references

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-using.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-having.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-and-polymorph-keys.html

Useful findings for future milestones:

- `ORDER BY` supports explicit `NULLS FIRST` / `NULLS LAST`; kysoql implements
  this as a separate modifier from `ASC` / `DESC`.
- SOQL condition expressions include `IN` / `NOT IN` value lists and
  multi-select-picklist `INCLUDES` / `EXCLUDES`; kysoql now implements those
  scalar-list forms, and `v1.0.55` adds typed `IN` / `NOT IN` semi-join and
  anti-join subquery operands with Salesforce's field/object/nesting limits.
- Relationship queries use declared Salesforce relationships only: child-to-parent
  traversal uses dotted relationship paths and permits at most five relationship
  levels. Parent-to-child traversal uses nested subqueries; REST/SOAP/Apex query
  calls support up to five levels of parent-to-child relationships in API version
  58.0 and later.
- Aggregate queries introduce their own result shape. `HAVING` filters aggregate
  results and can combine conditions with `AND`, `OR`, and `NOT`; semi/anti-join
  subqueries are not allowed inside `HAVING`.
- The SELECT grammar also includes subqueries, aggregate expressions,
  `FIELDS(...)`, translated/function expressions, and polymorphic `TYPEOF`.
  `TYPEOF` has compatibility restrictions with aggregate/grouping/function query
  forms, so it should be modeled explicitly rather than as a generic raw select
  expression.

Kysoql consequence: pursue broad REST/SOAP SOQL coverage incrementally, with
relationship-query and aggregate-query output typing treated as major architecture
milestones. Do not equate "all SOQL" with blindly exposing Apex-only execution
semantics in the transport-neutral core API.

## Salesforce CLI

### Credential retrieval change

Sources:

- https://github.com/forcedotcom/cli/issues/3560
- https://github.com/forcedotcom/cli/blob/main/releasenotes/README.md
- https://github.com/salesforcecli/plugin-org

Useful findings:

- Beginning with the May 27, 2026 CLI security changes, standard command output such as `sf org display --json` no longer reliably exposes sensitive credentials for automation.
- Scripts needing a token should call `sf org auth show-access-token --target-org <alias> --json` explicitly.

Kysoql consequence: schema-generation tooling obtains the instance URL from org display and the access token from the dedicated auth command. Never log the token.
