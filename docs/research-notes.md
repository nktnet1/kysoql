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
`GROUPING()`, date grouping functions, and ordering by aggregate expressions
remain separate follow-up work.

### GROUP BY ROLLUP and CUBE

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-rollup.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-cube.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html

Useful findings:

- `GROUP BY ROLLUP(...)` adds hierarchical subtotal rows from right to left plus a
  grand-total row; `GROUP BY CUBE(...)` adds subtotal rows for every grouping
  combination plus a grand total.
- Both advanced grouping forms accept at most three fields. Salesforce requires
  all grouped fields to be inside the `ROLLUP(...)` / `CUBE(...)` parentheses;
  ordinary `GROUP BY` syntax cannot be mixed with an advanced form in the same
  statement.
- Subtotal/grand-total rows can return `null` for a grouped field even when that
  field's source metadata is non-nullable, so result typing must add nullability
  independently of normal field nullability.

Implemented consequence in `v1.0.60`: aggregate builders expose additive typed
`.groupByRollup(...)` and `.groupByCube(...)` methods. They retain generated
`groupable` gating, reject mixed grouping modes, enforce the cumulative
three-field limit at the type and runtime boundaries, and compile through the
existing immutable `GroupByNode` with an explicit advanced mode. Grouped field
selection, `HAVING`, grouped ordering, and `LIMIT` continue to use the accumulated
grouping set. Selected ROLLUP/CUBE fields are recursively nullable at the selected
leaf so subtotal/grand-total rows are represented without weakening ordinary
`GROUP BY` output types. `GROUPING()` was intentionally kept for the following
separate slice.

### GROUPING

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-grouping.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-grouping.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby-cube.html

Useful findings:

- `GROUPING(fieldName)` identifies whether a `ROLLUP` / `CUBE` result row is a
  subtotal for one of the advanced grouping fields. It returns `1` for a subtotal
  and `0` otherwise.
- Salesforce documents `GROUPING(fieldName)` in `SELECT`, `HAVING`, and `ORDER BY`.
  Ordering by the indicators is useful for placing subtotal and grand-total rows
  after ordinary aggregate rows.
- The argument must remain tied to the accumulated advanced grouping set. Ordinary
  `GROUP BY` does not create the subtotal rows that `GROUPING()` identifies.

Implemented consequence in `v1.0.61`: the aggregate function module scopes typed
`GROUPING(field)` to the exact fields already accumulated by `groupByRollup(...)`
or `groupByCube(...)`. It is available through aliased aggregate selection,
unaliased `HAVING` operands, and a focused expression-callback `ORDER BY` overload.
Selection output and HAVING comparison values use the exact `0 | 1` indicator
type. Runtime validation mirrors the type boundary, and `OrderByItemNode` now
accepts the bounded aggregate-expression form without opening broader aggregate
ordering yet.

### Date grouping functions

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-date-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-convert-time-zone.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby.html

Useful findings:

- Salesforce documents thirteen date functions for grouping or filtering by
  calendar/fiscal periods. `CALENDAR_MONTH`, `CALENDAR_QUARTER`,
  `CALENDAR_YEAR`, `DAY_IN_MONTH`, `DAY_IN_WEEK`, `DAY_IN_YEAR`,
  `FISCAL_MONTH`, `FISCAL_QUARTER`, `FISCAL_YEAR`, `WEEK_IN_MONTH`, and
  `WEEK_IN_YEAR` accept date fields and return numbers; the documented examples
  also use the family with dateTime fields.
- `DAY_ONLY` and `HOUR_IN_DAY` accept only dateTime fields. `DAY_ONLY` returns a
  date value, while `HOUR_IN_DAY` returns a number.
- A date function selected by a grouped query must participate in `GROUP BY`.
  Salesforce permits grouping by the underlying date field as an exception for
  date (not dateTime) inputs, but exact expression membership is the uniform,
  conservative safe-builder rule.
- Client-query dateTime behavior is UTC unless `convertTimezone()` is applied.
  Salesforce permits `convertTimezone(datetimeField)` only inside a date
  function, so timezone conversion is an explicit nested-expression slice rather
  than implicit date-grouping behavior or a standalone selection.
- Fiscal functions are unavailable in organizations with custom fiscal years.
  That org-level setting is not present in generated field metadata, so the
  typed builder preserves the documented function but cannot statically prove
  org compatibility.

Implemented consequence in `v1.0.62`: the `fn` module exposes the complete
camel-cased date-function family through one frozen `DateFunctionNode` path.
Generated `groupable` plus `date` / `datetime` metadata gates inputs, including
child-to-parent references; `DAY_ONLY` and `HOUR_IN_DAY` are datetime-only.
Ordinary `groupBy(({ fn }) => ...)` accumulates the exact function identity, which
then scopes aliased selection, `HAVING`, and expression ordering at both type and
runtime boundaries. Numeric outputs preserve source/relationship nullability;
`DAY_ONLY` returns the generated API date representation (`string`) and compares
against `soqlDate(...)`. ROLLUP/CUBE remain field-only, preserving
`GROUPING(field)`'s documented field argument and existing subtotal semantics.

Implemented consequence in `v1.0.71`: `fn.convertTimezone(...)` creates a
dedicated frozen intermediate node restricted to generated, groupable
`datetime` references. Every date function accepts that intermediate expression
across ordinary GROUP BY, SELECT, HAVING, and ORDER BY while preserving its
existing output type and source nullability. Converted and UTC expressions have
different exact grouping identities. The intermediate builder deliberately has
no aliasing API and cannot be selected or nested independently of a date
function; runtime node validation mirrors those type-level boundaries.

### Aggregate expression ordering

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-agg-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-count.html
- https://developer.salesforce.com/docs/platform/graphql/guide/aggregate-orderby-examples.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html

Useful findings:

- Salesforce's row-producing aggregate family is `AVG(field)`, `COUNT(field)`,
  `COUNT_DISTINCT(field)`, `MIN(field)`, `MAX(field)`, and `SUM(field)`.
- Salesforce's aggregate ordering examples order grouped results by aggregate
  values and provide equivalent SOQL statements. Aggregate-value ordering
  requires grouping but does not require the ordered expression to appear in
  the selection list.
- Scalar `COUNT()` is a distinct query form. Salesforce explicitly disallows
  `ORDER BY` in a bare `COUNT()` query, so it must not flow through the
  row-producing aggregate-ordering API.
- General SOQL ordering supports `ASC` / `DESC` and explicit `NULLS FIRST` /
  `NULLS LAST`; aggregate result ordering uses the same order item modifiers.

Implemented consequence in `v1.0.64`: grouped aggregate builders accept
unaliased expression callbacks for the six row-producing aggregate functions in
`ORDER BY`. The callbacks reuse the existing generated aggregateability and
numeric-field constraints, support direction and null placement, and do not
require a matching selected expression. The type boundary excludes aliased
expressions and scalar `COUNT()`; runtime validation mirrors both restrictions.
Grouped field, exact date-function, and advanced `GROUPING(field)` ordering keep
their focused validation paths.

### Translated SELECT values with toLabel()

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-tolabel.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html

Useful findings:

- `toLabel(field)` returns a value translated into the querying user's language,
  falling back to the master value when no translation is available.
- Salesforce documents regular, multiselect, division, and currency-code
  picklists, plus special data-category, record-type-name, and History cases.
  Generated Describe field types safely identify ordinary `picklist` and
  `multipicklist` inputs; the other special cases are not uniformly
  distinguishable from arbitrary string fields in the current schema model.
- The function supports aliases, and Salesforce requires an alias when the same
  field appears more than once in a SELECT list. Requiring aliases for every
  function selection gives kysoql a deterministic result key and avoids implied
  transport-specific names.
- Salesforce does not permit `toLabel()` in `ORDER BY`; picklist ordering always
  follows the picklist's defined order. Translated-value filtering is documented
  separately and is not part of this SELECT-only slice.

Implemented consequence in `v1.0.65`: record and parent-to-child relationship
subquery builders accept aliased `fn.toLabel(...)` selections for generated
picklist and multipicklist references. A dedicated frozen function node compiles
as `toLabel(field) alias`; output values infer as `string` with field and
child-to-parent relationship nullability propagated. Callback selections are
additive alongside ordinary fields, duplicate aliases are rejected, invalid
unaliased nodes are rejected at runtime, and `ORDER BY` has no function overload.
The conservative field gate intentionally excludes special Salesforce cases
that current generated metadata cannot prove safely.

### Currency conversion with convertCurrency()

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-format.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html

Useful findings:

- `convertCurrency(field)` is a SELECT function that converts a currency field
  into the querying user's currency and requires the org's multiple-currencies
  feature to be enabled. Describe field metadata identifies currency fields but
  does not expose that org-level prerequisite.
- The function supports an alias and returns a numeric currency value. Localized
  symbols and display formatting are a separate `FORMAT(...)` concern.
- Salesforce forbids `convertCurrency()` in `WHERE`, forbids converting an
  aggregate-function result, and returns grouped aggregate currency results in
  the org default currency.
- Salesforce forbids a `convertCurrency()` expression in `ORDER BY`; ordering a
  currency field is already based on its converted value. This does not require
  a new expression-ordering overload.
- When advanced currency management is enabled, applicable opportunity records
  use dated exchange rates; otherwise conversion uses the most recent rate. Both
  behaviours are server-side runtime concerns.
- `FORMAT()` can wrap `convertCurrency()`, but that changes the output to a
  localized string and is best modeled as explicit node composition in the next
  slice.

Implemented consequence in `v1.0.66`: record and parent-to-child relationship
subquery builders accept aliased `fn.convertCurrency(...)` selections for
generated currency references, including child-to-parent paths. A dedicated
frozen function node compiles as `convertCurrency(field) alias`; output values
remain `number` with field and relationship nullability propagated. The shared
SELECT-function parser handles mixed `toLabel()`/`convertCurrency()` lists and
duplicate aliases consistently. The type surface intentionally exposes no
currency conversion in filtering, aggregate arguments, or expression ordering,
and documents rather than guesses whether multiple currencies are enabled.

### Localized SELECT values with FORMAT()

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-format.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html

Useful findings:

- `FORMAT(field)` localizes number, date, datetime, time, and currency field
  values according to the querying user's locale. Currency values include the
  appropriate currency code and formatting, and function results are strings.
- Salesforce supports aliases for formatted values and requires one when the
  same field appears more than once in a SELECT list. Kysoql consistently
  requires aliases for scalar SELECT functions to keep result keys explicit.
- `FORMAT(convertCurrency(field))` is a documented composition that first
  converts a currency value into the querying user's currency and then formats
  the result for their locale.
- Salesforce also permits aggregate-function nesting. Aggregate result rows have
  a distinct builder/type path, so that composition must retain aggregate-query
  routing and result nullability rather than weakening the record-selection API.
- `FORMAT()` is a SELECT function. This slice does not expose it through
  filtering or ordering callbacks.

Implemented consequence in `v1.0.68`: record and parent-to-child relationship
subquery builders accept aliased `fn.format(...)` selections for generated
`currency`, `double`, `int`, `percent`, `date`, `datetime`, and `time`
references, including child-to-parent paths. A dedicated frozen function node
compiles direct fields as `FORMAT(field) alias` and composes with the existing
unaliased currency builder as `FORMAT(convertCurrency(field)) alias`. Outputs
infer as localized strings with field and relationship nullability propagated.
In that patch, unsupported inputs, aliased nested expressions, aggregate
nesting, filtering, and ordering remained outside the type surface, with
matching runtime validation for invalid nested nodes.

Implemented consequence in `v1.0.69`: `fn.format(...)` also accepts unaliased
row-producing aggregate builders with field arguments. Formatted aggregates
remain aggregate selections, compile as `FORMAT(AGGREGATE(field)) alias`, and
infer localized string output while preserving whether the underlying aggregate
can return `null`. Bare `COUNT()`, already-aliased aggregates, and `GROUPING()`
indicators remain excluded so their dedicated query and grouping semantics are
not blurred.

### FIELDS selections

Source re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html

Useful findings:

- API version 51.0 and later supports `FIELDS(STANDARD)`, `FIELDS(CUSTOM)`, and
  `FIELDS(ALL)` in root and relationship-subquery SELECT lists.
- `FIELDS(...)` can be combined with explicitly named fields, but Salesforce
  rejects a query if expansion produces a duplicate field name.
- `FIELDS(STANDARD)` is bounded. In REST and SOAP queries, `FIELDS(CUSTOM)` and
  `FIELDS(ALL)` must be bounded; `LIMIT 200` or less is one documented bound.
- The field groups expand to fields on the selected object. They do not imply
  child-to-parent or parent-to-child relationship traversal.
- `FIELDS(CUSTOM)` on an object with no custom fields is invalid unless another
  field selection supplies an actual output field.

Implemented consequence in `v1.0.70`: record and relationship-subquery builders
expose `.selectFields("standard" | "custom" | "all")` through a dedicated frozen
AST node. Generated schema fields carry Salesforce's `custom` flag, output types
expand to the matching direct fields, and compile-time guards reject overlap with
explicit direct field selections in either call order. Compiler validation also
rejects repeated/overlapping field groups and requires `LIMIT <= 200` whenever
`CUSTOM` or `ALL` is selected.

### Geolocation expressions

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-geolocate.html

Useful findings:

- SOAP/REST SOQL can select a compound geolocation field directly, and the API
  returns the compound location as structured latitude/longitude data rather
  than a primitive scalar.
- `DISTANCE(location1, location2, 'unit')` accepts two location fields or a
  location field plus `GEOLOCATION(latitude, longitude)`. Supported units are
  `mi` and `km`.
- When `GEOLOCATION(...)` is used, the location field must be the first
  `DISTANCE()` argument and the `GEOLOCATION()` expression must be second.
  Reversing them produces a malformed query. `GEOLOCATION()` must be used with
  `DISTANCE()`.
- `DISTANCE()` is supported in `SELECT`, `WHERE`, and `ORDER BY`. Salesforce
  explicitly excludes `DISTANCE()` / `GEOLOCATION()` from `GROUP BY`.
- Distance filtering supports only `>` and `<`; Salesforce documents that
  geolocations/distances do not have useful equality semantics.
- Null or invalid compound geolocation values can produce null location/distance
  results, so generated field and relationship nullability must be preserved in
  inferred output.

Implemented consequence in `v1.0.72`: codegen maps Describe `location` fields
to a structured `SalesforceGeolocation` value, while ordinary scalar comparison,
ordering, aggregation, and grouping remain closed for that field type. Dedicated
frozen `GEOLOCATION` and `DISTANCE` nodes/builders validate coordinate literals
and `mi` / `km` units, enforce field-first argument order for fixed locations,
and support aliased distance selection, `<` / `>` filtering, and distance
ordering. Root and child-to-parent location references retain generated
filterable/sortable capabilities and relationship nullability; relationship
subqueries expose the same distance filter/order/select surface.

### Polymorphic `TYPEOF` selection

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-typeof.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-and-polymorph-keys.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describesobjects-describesobjectresult.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html

Useful findings:

- A `TYPEOF` target is the polymorphic **relationship name** (`What`, `Who`, or a
  relationship path ending in one), not its foreign-key field such as `WhatId`.
- Describe metadata identifies a polymorphic relationship when the reference field
  has a relationship name, `namePointing=true`, `polymorphicForeignKey=true`, and
  more than one referenced object in `referenceTo`. A multi-target reference alone
  is not enough.
- `TYPEOF` requires one or more `WHEN <Object> THEN <fieldList>` branches and can
  have an optional `ELSE`. Branch field lists are relative to the corresponding
  referenced object, and a polymorphic target in a parent path is supported.
- If there is no `ELSE` and the runtime object type matches no `WHEN`, Salesforce
  returns null for the polymorphic selection. Multiple independent TYPEOF
  expressions are allowed.
- Salesforce does not allow the TYPEOF relationship to also appear as a normal
  relationship field path in the same SELECT list. TYPEOF is also incompatible
  with SELECT functions, non-object/aggregate queries, `GROUP BY`, `ROLLUP`,
  `CUBE`, and `HAVING`; nested TYPEOF and semi-join SELECT use are not supported.
- Salesforce defines ELSE fields against its broader `Name` object abstraction.
  Kysoql does not yet model that pseudo-object, so a sound generated-schema-only
  subset is preferable to accepting arbitrary ELSE fields.

Implemented consequence in `v1.0.73`: codegen preserves the relevant Describe
flags and marks only confirmed multi-target named references as polymorphic. Core
adds a dedicated frozen TYPEOF AST and `.selectTypeOf()` builder whose `WHEN`
branches are restricted to generated `referenceTo` targets and whose fields are
typed against each target object. Output is a branch union discriminated by the
Salesforce record `attributes.type`, with parent relationship and unmatched-type
nullability preserved. Typed ELSE selections are conservatively limited to the
common field/path surface of all remaining generated targets. Query-mode types and
compiler/runtime validation prevent TYPEOF from mixing with SELECT functions
(including functions inside child subqueries), aggregate/grouping forms, duplicate
TYPEOF targets, or ordinary field selection through the same relationship.

### `USING SCOPE` next-slice notes

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-using-scope.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-limits.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html

Useful findings:

- API 32.0+ supports `USING SCOPE <filterScope>` on top-level SELECT queries.
- Salesforce explicitly says to obtain the scopes valid for a specific object from
  that object's Describe `supportedScopes`; each entry exposes a `name` and label.
  This makes generated object metadata preferable to a global hard-coded scope
  enum, because availability is object/org dependent.
- The clause is positioned after the root `FROM <object>` and before the normal
  filtering/grouping/order clauses in SELECT syntax.
- Salesforce explicitly disallows `USING SCOPE` for parent-child relationship
  queries, so it should remain a root-query capability rather than being copied to
  the relationship-subquery builder.

Kysoql consequence for `v1.0.74`: preserve Describe `supportedScopes` names in
codegen, constrain a root `.usingScope()` call to the selected object's generated
scope union, store it immutably, and compile it in the documented top-level clause
position. Keep `WITH DATA CATEGORY` separate because its object/category grammar
and Describe inputs are a different typing problem.

Implemented consequence in `v1.0.74`: codegen validates and preserves each
object's `supportedScopes` names and renders them as a sorted generated
string-literal union on `SalesforceObject`. Root record, aggregate, and scalar
`COUNT()` builders expose `.usingScope()` against that object-specific union. A
dedicated frozen `UsingScopeNode` gives repeated calls replacement semantics, and
the compiler emits `USING SCOPE` immediately after the root `FROM` clause. The
relationship-subquery builder remains deliberately unchanged because Salesforce
disallows the clause there.

### `WITH DATA CATEGORY` first-slice notes

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-datacategory.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-datacategory-catselection.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-knowledge-support-dcgroups.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroups.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroupstructures.html

Useful findings:

- SOQL `WITH DATA CATEGORY` is valid for `KnowledgeArticleVersion`, a specific
  Knowledge article type API name, and `Question`. Knowledge article queries must
  also include a `WHERE` predicate on `PublishStatus` or `Id`.
- A condition is a category-group API name, one of `AT`, `ABOVE`, `BELOW`, or
  `ABOVE_OR_BELOW`, and one or more category API names. Multiple categories for a
  single condition use parentheses and commas; multiple conditions use only
  `AND`.
- A query supports at most three data-category conditions, and the same category
  group cannot appear more than once. Bind variables are not supported in this
  clause.
- Data-category groups and their category trees do not come from ordinary sObject
  Describe. SOAP exposes `describeDataCategoryGroups()` plus
  `describeDataCategoryGroupStructures()` for `KnowledgeArticleVersion` and
  `Question`.
- REST exposes `/support/dataCategoryGroups`; `sObjectName` is required and only
  accepts `KnowledgeArticleVersion`. `topCategoriesOnly=false` returns the entire
  visible recursive category tree. The response is permission-contextual: only
  category groups/categories visible to the connected user are returned.

Kysoql consequence for `v1.0.75`: add a generated object-level map from category
group API name to the visible category-name union, then expose root
`.withDataCategory(group, selector, categoryOrCategories)` on record, aggregate,
and scalar `COUNT()` builders. Keep category inputs typed and non-empty, preserve
immutable accumulation, validate the maximum-three/unique-group rules at both the
builder and compiler boundaries, and emit the clause after `WHERE` and before
`GROUP BY` / ordering / limits. Relationship subqueries intentionally do not get
the method.

The bundled JSforce CLI uses the REST resource for `KnowledgeArticleVersion` and
`__kav` article targets, requesting the full tree once and reusing it across
article targets. Because Salesforce's REST resource does not support `Question`,
the generic codegen client exposes optional data-category discovery so another
adapter can supply the same normalized REST-shaped metadata; automatic
SOAP-backed Question discovery remains a follow-up. `v1.0.76` enforces the
Knowledge-specific `WHERE PublishStatus` / `WHERE Id` prerequisite at the compiler
boundary for `KnowledgeArticleVersion` and `__kav` article types. The guard walks
nested boolean WHERE expressions but only accepts direct root references named
`PublishStatus` or `Id`; `Question` queries are intentionally unaffected.

### `FOR VIEW` / `FOR REFERENCE` and Question SOAP-discovery notes

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-for-view-for-reference.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describesobjects-describesobjectresult.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/dome-mark-records-as-recently-viewed.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroups.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroupstructures.html
- https://jsforce.github.io/jsforce/classes/api_soap.SoapApi.html

Useful findings:

- Salesforce's SOAP category-describe calls support `Question`, but JSforce
  3.10.x does not expose `describeDataCategoryGroups()` or
  `describeDataCategoryGroupStructures()` on its public `SoapApi`. The generic
  `_invoke` escape path is an internal/private implementation detail, so the CLI
  should not couple itself to that transport internals solely to fill this gap.
  The existing optional `describeDataCategoryGroups` codegen hook remains the
  stable integration point for a caller that has a supported SOAP client.
- `FOR VIEW` and `FOR REFERENCE` are REST/SOAP-safe top-level SELECT clauses used
  to update recent-usage metadata. `FOR VIEW` updates `LastViewedDate` and recent
  usage; `FOR REFERENCE` updates `LastReferencedDate` and recent usage. Salesforce
  documents them after `OFFSET` in SELECT syntax and as alternatives, not a
  combined query mode.
- sObject Describe exposes `mruEnabled`, which tells clients whether MRU-list
  functionality is enabled for that object. This is the relevant generated
  object capability for recent-usage clauses; external objects are separately
  documented as not supporting `FOR VIEW` or `FOR REFERENCE`.

Kysoql consequence for `v1.0.77`: leave automatic `Question` category discovery
on the public optional codegen-client hook rather than importing JSforce private
SOAP internals. Preserve optional Describe `mruEnabled` in generated schemas and
add immutable root `.forView()` / `.forReference()` clauses gated when Describe
explicitly reports `false`. Missing metadata stays permissive for existing
hand-written/custom codegen clients. Repeated calls replace the prior mode, the
compiler emits the clause after `OFFSET`, and relationship-subquery builders stay
unchanged.

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
  `FIELDS(...)`, translated/function expressions, and polymorphic `TYPEOF`;
  `v1.0.70` implements the three `FIELDS(...)` groups for record queries.
  `TYPEOF` has compatibility restrictions with aggregate/grouping/function query
  forms, so it should be modeled explicitly rather than as a generic raw select
  expression.

Kysoql consequence: pursue broad REST/SOAP SOQL coverage incrementally, with
relationship-query and aggregate-query output typing treated as major architecture
milestones. Do not equate "all SOQL" with blindly exposing Apex-only execution
semantics in the transport-neutral core API.

### QueryAll execution

Sources re-checked on 2026-09-20:

- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-queryall.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-queryall-more-results.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-queryall.html
- https://github.com/jsforce/jsforce/blob/main/MIGRATING_V1-V3.md

Useful findings:

- Salesforce REST `QueryAll` executes SOQL through a separate `/queryAll`
  resource and can include soft-deleted records plus archived Task/Event rows.
- A paginated QueryAll response can return a `nextRecordsUrl` containing
  `/query/`; Salesforce explicitly states that following that locator still
  returns the remaining rows from the original QueryAll result set.
- Salesforce SOAP describes `queryAll()` as otherwise equivalent to `query()`
  apart from deleted/archived visibility, so the execution distinction belongs at
  the transport/executor boundary rather than in the query AST or compiler.
- JSforce v3 removed the old `Connection.queryAll()` convenience method. Its
  documented replacement is `connection.query(soql, { scanAll: true })`.

Kysoql consequence for `v1.0.90`: keep compiled SOQL unchanged and add
`.executeAll()` to root record, aggregate-result, and bare-`COUNT()` builders.
The transport-neutral executor contract exposes optional QueryAll hooks so custom
executors are not forced to implement the Salesforce-specific capability. The
first-party JSforce executor implements them with `scanAll: true` on the initial
request and the existing validated `queryMore` pagination loop thereafter.

## Codegen CLI framework

Sources re-checked on 2026-09-18:

- https://oclif.io/docs/introduction/
- https://oclif.io/docs/commands/
- https://oclif.io/docs/flags/
- https://oclif.io/docs/command_discovery_strategies/
- https://oclif.io/docs/esm/

Useful findings:

- oclif v4 models each operation as a `Command` class with a required async
  `run()` method. Command metadata and flag declarations drive parsing and help
  output from one definition.
- `Flags.string(...)` supports defaults and repeatable inputs. Using
  `multipleNonGreedy` with `multiple` preserves one object API name per repeated
  `--object` flag instead of greedily consuming adjacent values.
- oclif's explicit discovery strategy loads a named command map from one target
  file. The official documentation specifically identifies this strategy as
  useful when command code is bundled and filesystem naming cannot be used for
  discovery.
- An ESM executable delegates to oclif through `execute({ dir:
  import.meta.url })`; oclif then resolves the package configuration and command
  registry. Keeping the bin and registry as separate tsdown entries avoids
  publishing CLI internals through the package's library exports.

Implemented consequence in `v1.0.67`: `@kysoql/codegen` now depends directly on
`@oclif/core` and registers a real `generate` command through an explicit
`commands.mjs` bundle. oclif owns routing, strict flag parsing, repeatable object
flags, errors, and generated root/command help. The existing Salesforce
environment variables, output/schema defaults, generation flow, Valibot
validation of schema names, JSforce Describe adapter, and success message are
preserved.
The former handwritten parser and usage text are removed, command behaviour is
tested at the class boundary, and a built-executable smoke check covers command
discovery and help.

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

### Knowledge `UPDATE TRACKING` / `UPDATE VIEWSTAT` notes

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/service/salesforce-knowledge-dev-guide/guide/sforce-api-calls-soql-select-update-tracking-update-viewstat.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-typos.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select.html
- https://help.salesforce.com/s/articleView?id=000386899&language=en_US&type=1

Useful findings:

- `UPDATE TRACKING` and `UPDATE VIEWSTAT` are optional SOQL SELECT clauses for
  Salesforce Knowledge article search/view tracking. The former records Knowledge
  search keywords; the latter increments article view statistics.
- Salesforce's SELECT grammar places the `UPDATE` clause after the optional
  `FOR VIEW` / `FOR REFERENCE` position. The typographical-conventions reference
  explicitly states that `TRACKING`, `VIEWSTAT`, or both can be supplied, with the
  combined form comma-separated.
- The Knowledge guide and current Salesforce Help examples use concrete Knowledge
  article-version objects ending in `__kav`. Kysoql treats both
  `KnowledgeArticleVersion` and specific `__kav` article types as the Knowledge
  article query family, matching the existing Knowledge/data-category boundary.
  `Question` is not part of this article-specific UPDATE family even though it
  supports `WITH DATA CATEGORY`.
- The documented SOQL examples include predicates such as `Keyword`, `Language`,
  `PublishStatus`, and a specific article version, but Salesforce does not state
  those example predicates as a generic syntactic prerequisite for the UPDATE
  clause itself. Do not invent additional WHERE-shape validation from examples.
- The generic SELECT grammar positions the UPDATE clause after normal selection,
  grouping/order/limit/offset syntax. Keep it a top-level query capability and do
  not expose it on relationship-subquery builders.

Kysoql consequence for `v1.0.78`: add immutable `.updateTracking()` and
`.updateViewstat()` methods to root record, aggregate, and scalar `COUNT()`
builders, statically gate them to `KnowledgeArticleVersion` / `__kav` object
names, and retain a compiler-boundary object-family validation for unsafe/manual
ASTs. A dedicated frozen node accumulates the two modes without duplicates and
normalizes the combined compiler output to `UPDATE TRACKING, VIEWSTAT`. Emit the
clause after any `FOR VIEW` / `FOR REFERENCE` clause.

### UserProfileFeed `WITH UserId` follow-up

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html

Useful findings:

- Salesforce documents `WITH filteringExpression` for user-profile-feed change
  tracking separately from `WITH DATA CATEGORY` and Apex execution-context forms.
- The documented SOQL example is `SELECT Id FROM UserProfileFeed WITH
  UserId='005D0000001AamR' ORDER BY CreatedDate DESC, Id DESC LIMIT 20`.
- Salesforce's object-limit reference says a `UserProfileFeed` query must include
  `WITH UserId = ...`.

Kysoql consequence in `v1.0.79`: add a narrowly object-specific root
`.withUserId(userId)` API for `UserProfileFeed`, represented by a frozen clause
node whose scalar User ID value is compiled through the ordinary escaped SOQL
literal path. The method is unavailable on other root object types and all
relationship-subquery builders. Repeated calls replace the prior value. The
compiler emits `WITH UserId = ...` after `WHERE` and before grouping/ordering,
revalidates the clause for unsafe/manual ASTs, rejects the clause on other
objects, and rejects every `UserProfileFeed` query that omits it. The builder
accepts a non-empty string rather than inventing undocumented key-prefix or
15/18-character checks in core.

Apex-only `WITH SECURITY_ENFORCED`, `WITH USER_MODE` / `SYSTEM_MODE`, and `FOR
UPDATE` remain outside this REST/SOAP-focused slice.

### Object-specific required-filter limits

Source re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html

Useful findings:

- Salesforce requires every `ContentDocumentLink` SOQL query to filter on at
  least one of `Id`, `ContentDocumentId`, or `LinkedEntityId`.
- Salesforce requires every `ContentHubItem` SOQL query to filter on at least one
  of `Id`, `ExternalId`, or `ContentHubRepositoryId`.
- The current object-limit reference states these as required filter fields; it
  does not add a narrower operator/value-shape rule for these two objects. Keep
  the ordinary field/operator type system responsible for whether a specific
  predicate itself is legal.
- `Vote` is materially different: Salesforce documents four accepted predicate
  shapes, including specific `=` versus `IN` forms. `UserRecordAccess` also has
  specialized query/ORDER BY rules. Keep both out of the simple field-presence
  validator.

Kysoql consequence in `v1.0.80`: add a shared compiler-boundary validator for
the two straightforward root-WHERE requirements. It recursively inspects nested
boolean expressions but only counts direct root-field predicates, so unrelated
relationship references do not satisfy the invariant. The validation applies to
record, aggregate, and scalar `COUNT()` root queries without changing their
public builder APIs.

### Vote required-filter shapes

Source re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html

Useful findings:

- Salesforce restricts `Vote` queries to four documented root-WHERE predicate
  shapes: `ParentId = [single ID]`, `Parent.Type = [single type]`, `Id =
  [single ID]`, or `Id IN [list of IDs]`.
- This is stricter than the `ContentDocumentLink` / `ContentHubItem` rules:
  merely mentioning an allowed field is insufficient because the operator and
  right-hand value shape are part of the restriction.
- `Id IN (...)` must be a literal value list for this rule. A semi-join
  subquery on `Id` is a different SOQL shape and must not satisfy the Vote
  invariant.
- The object-limit reference does not specify additional boolean-expression
  placement rules around the qualifying predicate. Keep Kysoql's existing
  recursive root-WHERE inspection rather than inventing stricter `AND` / `OR`
  semantics.
- `Parent.Type` is Salesforce's polymorphic relationship type qualifier. The
  compiler validator must recognize that documented reference even though the
  current generated ordinary-field reference surface does not synthesize a
  `.Type` field.

Kysoql consequence in `v1.0.81`: extend the shared object-query-limit compiler
validator with a Vote-specific predicate matcher. Accept only non-empty scalar
strings for the three equality forms and a non-empty literal string list for
`Id IN (...)`; reject wrong operators and semi-join RHS nodes. Keep this as a
compiler-boundary slice without broadening the ordinary filter API.

### UserRecordAccess query restrictions

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html
- https://help.salesforce.com/s/articleView?id=000386023&language=en_US&type=1
- https://help.salesforce.com/s/articleView?id=000386187&language=en_US&type=1
- https://help.salesforce.com/s/articleView?id=000383422&language=en_US&type=1
- https://help.salesforce.com/s/articleView?id=platform.admin_troubleshoot_queries.htm&language=en_US&type=5

Useful findings:

- `UserRecordAccess` uses a specialized query shape rather than ordinary free-form
  object filtering. The documented examples identify one user with `UserId =
  <single ID>` and one record or record set with either `RecordId = <single ID>`
  or `RecordId IN (<ID list>)`.
- Salesforce enforces a maximum of 200 values in the `RecordId IN (...)` set for
  this object. A trailing query `LIMIT 200` does not relax that restriction.
- Salesforce examples allow one access predicate such as `HasReadAccess = true`
  together with the user/record predicates. In that access-filter form the
  documented selection is `RecordId` only. Without the access predicate,
  `RecordId` can be selected alongside the concrete `HasReadAccess`,
  `HasEditAccess`, `HasDeleteAccess`, `HasTransferAccess`, `HasAllAccess`, and
  `MaxAccessLevel` result fields.
- `RecordId` must be explicitly selected. Salesforce's current SOQL object-limit
  reference also couples selected access-result fields to ordering: selected
  `Has*Access` fields must be ordered by the corresponding field, and selected
  `MaxAccessLevel` must be ordered by `MaxAccessLevel`.
- This restriction couples WHERE structure, SELECT shape, ORDER BY, and runtime
  list cardinality. Encoding the complete state machine in public builder
  generics would add substantial complexity while still requiring runtime
  validation for unsafe/manual ASTs and list lengths.

Kysoql consequence in `v1.0.82`: keep the ordinary typed field/filter API intact
and validate the complete `UserRecordAccess` shape at the compiler boundary.
Require exactly one scalar `UserId` equality and one scalar-or-literal-list
`RecordId` predicate, allow at most one concrete `Has*Access = TRUE` predicate,
reject non-conjunctive/extra predicates, cap literal record IDs at 200, enforce
`RecordId`-centred selections and matching ORDER BY fields, and reject aggregate
or scalar `COUNT()` selections. The validator intentionally uses only the known
access-result fields rather than treating arbitrary `Has*Access` spellings as
valid compiler AST input.

### Feed relationship `ORDER BY` restriction

Source re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html

Useful findings:

- `NewsFeed` and `UserProfileFeed` have permission-dependent row caps when the
  running user lacks `View All Data`; those caps cannot be enforced correctly by
  the transport-neutral compiler without caller execution-context information.
- Independently of that permission-dependent limit, Salesforce states that SOQL
  `ORDER BY` on fields using relationships is unavailable for both feed objects.
  Ordering must use fields on the root feed object.
- The restriction applies to the field referenced by the ordering expression, not
  just the simplest `ORDER BY Parent.Name` spelling. Compiler validation should
  therefore inspect all currently supported order-expression node kinds for
  relationship references.

Kysoql consequence in `v1.0.83`: extend the shared object-query-limit compiler
validator for root `NewsFeed` and `UserProfileFeed` queries. Reject any `ORDER BY`
expression that references a dotted relationship path while preserving root-field
ordering. Keep the permission-dependent 1,000-row caps unenforced.


### External-object and custom-metadata query-limit audit

Sources re-checked on 2026-09-19:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html
- https://developer.salesforce.com/docs/platform/lwc/guide/data-wire-service-about.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html

Useful findings:

- Salesforce's standard sObject Describe result does not expose an object-level
  boolean that identifies an external object. Salesforce does, however, define
  `__x` as the API-name suffix for external custom objects, while custom metadata
  types use the distinct `__mdt` suffix. Because these suffixes are part of the
  platform API naming model, they are a stable fallback for object-family limits
  that Describe cannot express.
- Custom metadata types support metadata relationship fields in SELECT and WHERE.
  Their WHERE operator surface is limited to `IN`, `NOT IN`, `=`, `!=`, `>`,
  `>=`, `<`, `<=`, `LIKE`, and logical `AND`; `OR` is supported only on the
  same column using `LIKE` / `=` predicates. `ORDER BY` is restricted to
  non-relationship fields.
- External objects universally reject `AVG`, fielded `COUNT`, `MIN`, `MAX`,
  `SUM`, `GROUP BY`, `HAVING`, `LIKE`, `INCLUDES`, `EXCLUDES`, `toLabel()`,
  `TYPEOF`, `FOR VIEW`, `FOR REFERENCE`, and `WITH`. Bare `COUNT()` is listed
  separately as supported, though some adapters require external-source row-count
  support at execution time.
- Additional external-object limits are adapter-specific. OData adapters restrict
  relationship ordering and can gate `COUNT()` on `Request Row Counts`; custom
  adapters reject location queries, `convertCurrency()`, Knowledge usage updates,
  and `USING SCOPE`. These must not be promoted to unconditional compiler errors
  without adapter capability metadata.
- External-object subquery row caps and the four-join limit cannot currently be
  enforced reliably from the root compiler AST because relationship subqueries do
  not retain enough target-object/adapter identity.

Kysoql consequence in `v1.0.84`: recognize `__mdt` / `__x` at the compiler
boundary and enforce only the documented universal restrictions that the current
AST can represent accurately. Preserve metadata relationship SELECT/WHERE support,
keep bare external-object `COUNT()`, and leave adapter-specific rules to future
execution-capability metadata instead of guessing.

### Apex `FOR UPDATE` execution-context boundary

Sources re-checked on 2026-09-20:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-for-update.html
- https://developer.salesforce.com/docs/platform/lwc/guide/apex-security
- https://developer.salesforce.com/blogs/2026/06/the-salesforce-developers-guide-to-the-summer-26-release

Useful findings:

- Salesforce documents `FOR UPDATE` as Apex-only SOQL syntax for locking the
  selected sObject records until the enclosing transaction completes.
- A locking query cannot contain `ORDER BY`.
- The existing REST/JSforce executor is therefore the wrong execution surface
  for `FOR UPDATE`; exposing the clause directly on ordinary executable builders
  would make a transport-neutral query compile into syntax its configured
  executor cannot soundly run.
- Apex access-mode syntax also remains execution-context-specific. Salesforce's
  current API 67 guidance changes Apex security defaults and retires older
  `WITH SECURITY_ENFORCED` behavior, so future access-mode support needs an
  explicit API-version/context model rather than assuming one timeless default.

Kysoql consequence for `v1.0.92`: add a terminal `.apex()` context switch only
on row-producing root `SelectQueryBuilder`. The returned `ApexSelectQueryBuilder`
is compile-only and deliberately exposes neither `.execute()` nor
`.executeAll()`. Its first Apex-specific clause is immutable `.forUpdate()`,
represented by a frozen `ForUpdateNode`; the compiler emits `FOR UPDATE` at the
end of the statement and rejects any query that also has `ORDER BY`. Aggregate
and bare-`COUNT()` builders do not expose the Apex context because record locking
has no sound aggregate result semantics.
