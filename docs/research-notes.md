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
Relative date literals such as `TODAY` are not part of this slice.

### Relationships

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-limits.html

Useful findings:

- SOQL uses declared Salesforce relationships rather than arbitrary SQL joins.
- Child-to-parent traversal uses relationship paths; parent-to-child uses subqueries.

Kysoql consequence: do not add SQL-style arbitrary joins to the safe API.

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
