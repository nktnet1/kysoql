# Research notes

This file is a compact source/constraint ledger for kysoql. Keep durable external
facts here when they materially affect architecture or query semantics. Completed
patch history belongs in Git and `CHANGELOG.md`.

Re-check sources when implementing behavior that depends on current Salesforce,
JSforce, TypeScript, or Kysely releases.

## Kysely architecture

Sources:

- https://github.com/kysely-org/kysely/blob/master/src/query-creator.ts
- https://github.com/kysely-org/kysely/blob/master/src/query-builder/select-query-builder.ts
- https://github.com/kysely-org/kysely/blob/master/src/operation-node/query-node.ts
- https://github.com/kysely-org/kysely/blob/master/src/parser/select-parser.ts
- https://github.com/kysely-org/kysely/blob/master/src/raw-builder/raw-builder.ts
- https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html

Settled findings:

- Kysely separates query construction, compilation, and execution.
- Builders clone immutable operation nodes rather than mutating previous builders.
- Selected output is accumulated in the builder's output type.
- Repeated `where()` calls combine through boolean operation nodes.
- Repeated `orderBy()` calls are additive and preserve call order.
- Current Kysely exposes neutral builder helpers such as `$call`, `$if`, and
  clause-clearing methods (`clearWhere`, `clearOrderBy`, `clearLimit`,
  `clearOffset`, `clearSelect`, and `clearGroupBy`). Kysoql now covers this neutral
  set where each operation maps soundly to a specialised SOQL builder. `$if` keeps
  newly selected output fields optional and does not allow a true-only structural
  mode transition to masquerade as unconditional state. `clearSelect()` resets the
  selection accumulator while preserving SOQL-specific builder context, and
  aggregate `clearGroupBy()` rejects removals that would leave grouped selections,
  `HAVING`, grouped `ORDER BY`, or grouped `LIMIT` behind. That stricter guard is a
  deliberate SOQL-safety deviation rather than an outstanding parity gap.
- Lowercase builder spelling such as `asc` / `desc` is appropriate even when the
  compiler emits uppercase database syntax.
- Kysoql should follow these conventions only where they map naturally to SOQL.
  SQL-only concepts such as arbitrary joins are not parity targets.

## JSforce and Salesforce Describe

Sources:

- https://jsforce.github.io/jsforce/classes/connection.Connection.html
- https://jsforce.github.io/jsforce/classes/query.Query.html
- https://jsforce.github.io/jsforce/modules/query.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html

Settled findings:

- `Connection.query()` returns a query result/thenable query and `queryMore()`
  follows Salesforce locators.
- JSforce automatic fetching is bounded by `maxFetch`; kysoql must follow
  pagination explicitly instead of silently truncating results.
- Describe metadata provides the field, relationship, and capability information
  required by codegen, while raw JSforce SOQL strings themselves are not type-safe.
- JSforce belongs at the transport/Describe boundary; core owns the typed SOQL
  AST/compiler.

### QueryAll

Sources:

- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-queryall.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-queryall-more-results.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-queryall.html
- https://github.com/jsforce/jsforce/blob/main/MIGRATING_V1-V3.md

Settled findings:

- API QueryAll is a transport operation for including deleted records and archived
  activities; it does not change compiled SOQL text.
- QueryAll pagination can continue through ordinary query locators while retaining
  QueryAll semantics.
- JSforce v3 uses `query(soql, { scanAll: true })` instead of the old
  `Connection.queryAll()` convenience method.

## Salesforce SOQL

### Literals, comparison operators, and conditions

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-reservedcharacters.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-conditionexpression.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-dateformats.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html

Settled findings:

- Quoted strings escape single quotes and backslashes with backslashes; `LIKE`
  uses `%` / `_` wildcards and supports escaping them.
- Operator validity is Salesforce-field-type-dependent and should come from
  generated metadata rather than JavaScript value types alone.
- Date/dateTime/time filter literals require explicit SOQL formatting. Returned
  temporal values can stay strings while input literals use typed wrappers.
- Relative-date literals are unquoted tokens and include fixed and parameterized
  calendar/fiscal families.
- Multi-currency orgs support ISO-coded numeric `WHERE` literals such as
  `USD5000`. Kysoql models these through `soqlCurrency(code, value)` only for
  generated currency fields. Bare numeric values retain Salesforce's normal
  comparison semantics, and `IN` / `NOT IN` lists cannot mix ISO-coded and
  non-ISO values. ISO-coded values remain excluded from aggregate `HAVING`.

### ORDER BY, LIMIT, and OFFSET

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html

Settled findings:

- `ORDER BY` supports `ASC` / `DESC` and explicit `NULLS FIRST` / `NULLS LAST`.
- Salesforce does not support explicit `NULLS FIRST` / `NULLS LAST` when ordering
  by a relationship/reference field that can contain null. Generated nullable
  reference metadata is sufficient to prevent that invalid combination; kysoql
  uses it to remove the null-placement argument from nullable reference-field
  `orderBy()` calls while leaving ordinary nullable sortable fields unchanged.
- `OFFSET` is bounded to `0..2000` and is a top-level production feature for
  REST, SOAP, and Apex query contexts.
- Parent-to-child subquery `OFFSET` is allowed only when the parent has `LIMIT 1`
  and remains a pilot feature that Salesforce says is not intended for production.
- For reliable pagination of a changing/large result set, query locators are
  preferable to repeated `OFFSET` queries.

### Relationships

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-using.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-query-limits.html
- https://developer.salesforce.com/docs/platform/salesforce-app-limits-cheatsheet/guide/salesforce-app-limits-platform-soslsoql.html

Settled findings:

- SOQL uses declared Salesforce relationships, not arbitrary SQL joins.
- Child-to-parent traversal supports up to five relationship levels.
- API 58+ REST/SOAP/Apex queries support up to five total parent-to-child levels
  for standard/custom objects; the query can contain at most 20 parent-to-child
  relationships and 55 child-to-parent relationships.
- Reusing the same relationship path counts once; deeper prefixes count as their
  own relationships. Polymorphic relationships can consume multiple slots.
- Relationship query output is nested. Nullable lookups can yield a null parent;
  child subqueries return their own query-result envelope.
- Repeated Describe rows can share a child `relationshipName`; codegen must retain
  all concrete child-object/foreign-key alternatives instead of emitting duplicate
  TypeScript properties.

### Semi-joins and anti-joins

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-comparisonoperators.html

Settled findings:

- `IN` / `NOT IN` can take a subquery for semi/anti-joins.
- The outer operand must be a direct ID/reference field; relationship traversal is
  not permitted there.
- The inner query selects exactly one compatible direct ID/reference field.
- Salesforce restricts nesting, supported objects, self-joins, and boolean
  placement; these must remain explicit typed/compiler constraints rather than a
  generic subquery API.

### Aggregates, grouping, and functions

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-groupby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-group-by-considerations.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-having.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-grouping.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-tolabel.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-format.html

Settled findings:

- Aggregate queries have a distinct result shape; generated `aggregatable` /
  `groupable` metadata must gate safe function/grouping use.
- Salesforce also permits `GROUP BY` without any aggregate function to return
  the distinct grouped values, including `null`; kysoql exposes this directly from
  an unselected root builder and then reuses the grouped-result builder.
- Queries using `GROUP BY` cannot use child relationship expressions written with
  custom `__r` syntax. Kysoql enforces this in typed grouping references and again
  at the compiler boundary, while keeping standard relationship paths valid.
- `HAVING` filters grouped results and supports boolean composition, but should
  not inherit unsupported `WHERE` features by analogy alone.
- `ROLLUP` / `CUBE`, `GROUPING()`, date grouping functions, and aggregate ordering
  have expression-membership restrictions that belong in the type system/AST.
- `toLabel()` supports SELECT and translated picklist filtering, but not ORDER BY;
  WHERE has documented exclusions such as division/currency-ISO picklists.
- `convertCurrency()` is SELECT-only; currency filter conversion uses ISO-coded
  literals instead. Aggregate currency results have additional documented rules.
- `FORMAT()` is SELECT-oriented localized output and has its own aliasing/nesting
  rules.

### `FIELDS(...)`, geolocation, and polymorphism

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-fields.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-geo.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-typeof.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-relationships-and-polymorph-keys.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-filtering-polymorphic-relationships.html

Settled findings:

- `FIELDS(STANDARD|CUSTOM|ALL)` expands to typed direct-field output from
  generated metadata. `FIELDS(ALL)` and `FIELDS(CUSTOM)` are unbounded selectors:
  REST/SOAP/CLI queries must cap rows with `LIMIT <= 200`, `Id IN (...)` containing
  at most 200 IDs, or at most 200 direct `Id = ...` tests joined by boolean
  operators. Apex does not support either unbounded selector, even for dynamic
  SOQL. `FIELDS(STANDARD)` remains supported in Apex.
- `FIELDS(CUSTOM)` as the complete field list fails when the object has no custom
  fields; adding another selected field makes the field list valid. Generated
  custom-field metadata can enforce this for the typed builder surface.
- Geolocation expressions require location-specific structured operands rather
  than raw expression strings.
- `TYPEOF` is tied to polymorphic references and has compatibility restrictions
  with aggregate/grouping/function query forms.
- Salesforce exposes a virtual relationship `.Type` qualifier for polymorphic
  references; it is filter/select syntax derived from source-reference metadata,
  not an ordinary sortable/groupable/aggregatable field.

### Scopes, categories, MRU, and Knowledge clauses

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-using-scope.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-datacategory.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-datacategory-catselection.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-for-view-for-reference.html
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-knowledge-support-dcgroups.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroups.html
- https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describedatacategorygroupstructures.html
- https://developer.salesforce.com/docs/service/salesforce-knowledge-dev-guide/guide/sforce-api-calls-soql-select-update-tracking-update-viewstat.html

Settled findings:

- `USING SCOPE` is object-capability-specific and is not valid in parent-child
  relationship queries.
- `WITH DATA CATEGORY` depends on visible taxonomy, has selector/category/group
  rules, and belongs in generated object metadata rather than free-form strings.
- REST taxonomy discovery supports Knowledge article targets; `Question` requires
  the SOAP category APIs, so automatic Question discovery should wait for a stable
  supported transport path rather than private JSforce internals.
- `FOR VIEW` / `FOR REFERENCE` are MRU-related root clauses and can be gated by
  Describe's `mruEnabled` capability when known.
- Knowledge `UPDATE TRACKING` / `UPDATE VIEWSTAT` are specialist root clauses and
  require object-family validation.

### `WITH RecordVisibilityContext`

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-recordvisibilitycontext.html

Settled findings:

- Salesforce documents `RecordVisibilityContext` as an API 48+ `WITH` filtering
  form for querying record-visibility attributes.
- At least one parameter is required. `maxDescriptorPerRecord` is an integer;
  `supportsDomains` and `supportsDelegates` are booleans.
- It occupies the query's `WITH filteringExpression` position, so the safe builder
  models it as structured root-query syntax rather than a generic raw `WITH`
  expression or a relationship-subquery feature.

### Object-specific restrictions

Primary source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html

Additional sources:

- https://help.salesforce.com/s/articleView?id=000386023&language=en_US&type=1
- https://help.salesforce.com/s/articleView?id=000386187&language=en_US&type=1
- https://help.salesforce.com/s/articleView?id=000383422&language=en_US&type=1
- https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html

Settled findings:

- Some objects require particular filters or query shapes (for example Vote,
  UserRecordAccess, ContentDocumentLink, ContentHubItem, and UserProfileFeed).
- Feed relationship ordering and external-object relationship queries have extra
  restrictions that should be enforced only when the compiler has enough context
  to do so soundly.
- Big Objects, external adapters, Data 360, permission-sensitive limits, and
  runtime-cardinality rules can require execution/metadata context unavailable to
  a static transport-neutral builder. Do not guess those constraints.
- Custom metadata and external-object suffixes are useful compiler-level signals,
  but suffix detection alone is not a substitute for adapter capabilities.

## Apex-specific SOQL context

### `FOR UPDATE`, `ALL ROWS`, and access modes

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-for-update.html
- https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL_query_all_rows.htm
- https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_apex_developer_guide.pdf
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with.html
- https://developer.salesforce.com/blogs/2026/06/the-salesforce-developers-guide-to-the-summer-26-release

Settled findings:

- `FOR UPDATE` is Apex-only locking syntax and cannot be combined with `ORDER BY`.
- `ALL ROWS` is Apex SOQL syntax for deleted/archived visibility; API clients use
  QueryAll instead. Salesforce documents `ALL ROWS` on record/aggregate-style
  statements including bare `COUNT()`, and forbids combining it with `FOR UPDATE`.
- `WITH USER_MODE` / `WITH SYSTEM_MODE` are Apex execution-access clauses. Do not
  infer one timeless default mode because Salesforce's API-version guidance has
  changed; compile an explicit mode only when requested.
- Retired `WITH SECURITY_ENFORCED` behavior should not be reintroduced as a
  generic modern access-mode feature.

### Static Apex bind expressions

Sources:

- https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/langCon_apex_SOQL_variables.htm
- https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_apex_developer_guide.pdf
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-limits.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-multiselect-picklists.html

Settled findings:

- Static Apex supports binds in documented query positions including filters and
  numeric pagination positions; do not infer undocumented positions from similar
  SOQL grammar.
- Bind expressions can include member paths and specifically documented structured
  expression families. Kysoql should model those as typed AST, never raw Apex text.
- Salesforce documents bind-left multipicklist `INCLUDES`; that is distinct from
  the normal field-left multipicklist filter shape.
- Knowledge article query families have documented Apex-bind restrictions and need
  compiler-boundary protection.
- The current Apex bind guide does not establish general `HAVING` bind support;
  keep it absent unless Salesforce documents or a deliberate real-org fixture
  proves it.

## `SET OPTIONS`

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-set-options.html

Settled findings:

- `SET OPTIONS` is a trailing SOQL clause. `dataspace` applies to Data 360 DLO
  queries and a DLO query that uses the clause must name its dataspace to return
  records.
- `honorEmptyStrings=true|false` applies to DLOs and simple DMO queries.
- Kysoql now derives DLO (`__dll`) / DMO (`__dlm`) capability metadata during
  code generation. Typed DLO options require `dataspace`; typed DMO options expose
  only `honorEmptyStrings`, and DMO aggregate/grouped use is rejected.
- `explicitNamespace` is a separate managed dynamic Apex form: Salesforce requires
  a bound `Database.QueryOptions` object (`SET OPTIONS :queryOptions`) passed to
  dynamic SOQL. Kysoql models this through the distinct compile-only
  `.dynamicApex()` context and a typed `ApexDatabaseQueryOptions` bind marker; the
  existing `.apex()` surface remains static Apex and rejects the bound form.

## Closed verification targets

### Grouped aggregate `OFFSET`

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-group-by-considerations.html

Current evidence and implementation:

- Salesforce documents top-level `OFFSET` as supported in SOAP API, REST API, and
  Apex and does not list aggregate/grouped queries as an exclusion. Grouped REST
  and SOAP queries also cannot continue through their normal query-locator /
  `queryMore()` mechanisms, making bounded top-level pagination particularly
  relevant for grouped result sets.
- Kysoql exposes `offset()` only after `GROUP BY` on normal aggregate builders and
  reuses the existing `0..2000` parser. `clearOffset()` preserves immutable
  builder semantics, and clearing grouping is rejected while grouped `OFFSET`
  remains. Bare `COUNT()` intentionally stays without `OFFSET`.
- `pnpm salesforce:aggregate-offset` runs a deterministic grouped aggregate query
  through Salesforce CLI against the maintained fixture, and
  `pnpm salesforce:setup` runs that smoke check automatically after seeding.

## Recent documented surface

### `FORMULA()` in `WHERE` Beta

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-formula.html
- https://developer.salesforce.com/blogs/2026/06/simplify-your-soql-queries-using-soql-formula-in-where

Confirmed current documentation:

- The current SOQL reference now labels arithmetic `FORMULA()` a Beta service;
  the June 2026 launch post still describes the earlier pilot/enrollment state.
- `FORMULA()` is available only in `WHERE`, not SELECT or HAVING.
- Supported operand families are Double/Decimal, Integer, DateTime, Date, and
  Currency, with only `+` / `-` arithmetic. A non-date left operand cannot use a
  date right operand, and DATE/DATETIME cannot be mixed.
- Kysoql exposes the Beta feature visibly through `eb.beta.formula(...)`, builds
  the quoted formula body from typed field references rather than raw text, and
  keeps it off SELECT/HAVING expression builders. Generic scratch-org validation
  does not assume Beta access is enabled.

## Remaining research targets

These correspond to the active roadmap in `docs/chatgpt-handoff.md`; do not grow
this into a speculative backlog.

### Relationship-subquery `OFFSET` pilot

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html

Confirmed current documentation:

- A parent-to-child subquery may use `OFFSET` only when the parent query has
  `LIMIT 1`.
- Salesforce still labels this a pilot feature not intended for production.
- Keep production-safe builders without this method unless that status changes or
  the project explicitly chooses to expose pilot syntax.
