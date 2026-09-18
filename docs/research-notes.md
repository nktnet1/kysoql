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

Sources re-checked on 2026-09-18:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-date-functions.html
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
  Timezone conversion remains a separate future function slice rather than an
  implicit behavior of date grouping.
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
against `soqlDate(...)`. ROLLUP/CUBE remain field-only so `GROUPING(field)` keeps
its documented field argument and existing subtotal semantics.

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
- Salesforce also permits aggregate-function nesting, but aggregate result rows
  have a distinct builder/type path. That composition remains a later,
  aggregate-specific addition instead of weakening the record-selection API.
- `FORMAT()` is a SELECT function. This slice does not expose it through
  filtering or ordering callbacks.

Implemented consequence in `v1.0.68`: record and parent-to-child relationship
subquery builders accept aliased `fn.format(...)` selections for generated
`currency`, `double`, `int`, `percent`, `date`, `datetime`, and `time`
references, including child-to-parent paths. A dedicated frozen function node
compiles direct fields as `FORMAT(field) alias` and composes with the existing
unaliased currency builder as `FORMAT(convertCurrency(field)) alias`. Outputs
infer as localized strings with field and relationship nullability propagated.
Unsupported inputs, aliased nested expressions, aggregate nesting, filtering,
and ordering remain outside the type surface, with matching runtime validation
for invalid nested nodes.

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
