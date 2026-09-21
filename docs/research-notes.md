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
- Current Kysely also exposes neutral builder helpers such as `$if`, `$call`, and
  clause-clearing methods (`clearWhere`, `clearOrderBy`, `clearLimit`,
  `clearOffset`, `clearSelect`, and `clearGroupBy`). Kysoql currently lacks these,
  so they are valid parity-audit candidates if their typing remains sound.
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
- Multi-currency orgs support ISO-coded numeric filter literals such as
  `USD5000`. Bare numeric values retain Salesforce's normal comparison semantics.
  `IN` lists cannot mix ISO-coded and non-ISO values.

### ORDER BY, LIMIT, and OFFSET

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-orderby.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-limit.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html

Settled findings:

- `ORDER BY` supports `ASC` / `DESC` and explicit `NULLS FIRST` / `NULLS LAST`.
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
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-having.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-grouping.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-functions.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-tolabel.html
- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-format.html

Settled findings:

- Aggregate queries have a distinct result shape; generated `aggregatable` /
  `groupable` metadata must gate safe function/grouping use.
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

- `FIELDS(STANDARD|CUSTOM|ALL)` has bounded-query restrictions and should expand
  to typed direct-field output from generated metadata.
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
- At least one parameter is required. Documented parameters include
  `maxDescriptorPerRecord`, `supportsDomains`, and `supportsDelegates`.
- This should be modeled as structured syntax with validated parameter names/types,
  not as a generic raw `WITH` expression.

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

## Remaining research targets

These correspond to the active roadmap in `docs/chatgpt-handoff.md`; do not grow
this into a speculative backlog.

### `WITH RecordVisibilityContext`

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-with-recordvisibilitycontext.html

Confirmed gap:

- Add a typed, structured `WITH RecordVisibilityContext` surface.
- Require at least one documented parameter and validate numeric/boolean values.
- Do not generalize the implementation into a raw `WITH` escape hatch.

### ISO-coded currency literals

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-querying-currency-fields.html

Confirmed gap:

- Model `ISO_CODE + numeric value` as a structured typed currency filter literal.
- Preserve Salesforce's rule that an `IN` list cannot mix ISO-coded and bare
  numeric values.
- Do not model `convertCurrency()` in `WHERE`; Salesforce explicitly directs
  filters to ISO-coded literals instead.

### `FORMULA()` in `WHERE` (beta)

Sources:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-formula.html
- https://developer.salesforce.com/blogs/2026/06/simplify-your-soql-queries-using-soql-formula-in-where

Confirmed current documentation:

- `FORMULA()` is beta and available in `WHERE`, not SELECT.
- It supports `+` / `-` arithmetic over documented numeric/date/currency field
  families and compares the result with normal comparison operators/literals.
- If adopted, model operands/operators structurally and keep beta support explicit.

### Relationship-subquery `OFFSET` pilot

Source:

- https://developer.salesforce.com/docs/platform/salesforce-soql-sosl/guide/sforce-api-calls-soql-select-offset.html

Confirmed current documentation:

- A parent-to-child subquery may use `OFFSET` only when the parent query has
  `LIMIT 1`.
- Salesforce still labels this a pilot feature not intended for production.
- Keep production-safe builders without this method unless that status changes or
  the project explicitly chooses to expose pilot syntax.

### Kysely-neutral builder ergonomics

Source:

- https://kysely-org.github.io/kysely-apidoc/interfaces/SelectQueryBuilder.html

Confirmed parity candidates:

- Kysoql currently lacks Kysely's `$if`, `$call`, `clearWhere`, `clearOrderBy`,
  `clearLimit`, `clearOffset`, `clearSelect`, and `clearGroupBy` helpers.
- Audit their type behavior across record, aggregate, relationship-subquery, and
  Apex builder modes before adopting them.
- Do not treat arbitrary joins, raw SQL/expression escape hatches, or other
  SQL-specific features as missing kysoql functionality.
