# ChatGPT continuation handoff

This is the primary continuity document for a **new ChatGPT instance with no
conversation context**. Read it before changing code or generating a patch.
`docs/research-notes.md` contains the external references and settled Salesforce /
Kysely findings that support the architecture below.

## Fresh-session bootstrap: do this first

1. **Treat the supplied Git bundle/repository as authoritative.** Inspect its
   actual state before trusting version numbers in this document. A Git bundle
   contains committed history only; it does not contain somebody else's
   uncommitted working tree.
2. Read this file and `docs/research-notes.md` before making architectural
   changes.
3. Inspect the current package/test structure and the immediately relevant
   implementation before researching externally. Most continuation work should
   be derivable from the code and these docs; avoid long research detours unless
   a Salesforce rule is genuinely unclear.
4. If dependencies are available, run `pnpm validate` before and after the
   change. The user commonly runs validation locally and supplies any failure
   log; if so, fix **that failure only** before moving on.
5. Work in **coherent incremental slices**. Group repetitive syntax families when
   they share the same validation/type/AST/compiler path instead of producing tiny
   near-identical patches. Do not bundle the next major roadmap item, cleanup, or
   unrelated refactors into the same patch.
6. Patch filenames are sequential: `v1.0.<n>-<short-description>.patch`. Never
   reuse or rewrite a version already handed off. After `v1.0.99`, the next patch
   is `v1.0.100`.
7. Before handing off a patch, at minimum run:

   ```bash
   git diff --check
   git apply --check /path/to/v1.0.<n>-*.patch
   ```

   Also run the narrowest available type/test command. Do not repeatedly tell the
   user that pnpm or dependencies are unavailable in the execution environment;
   they already know. Report substantive checks such as tests/typechecks when useful,
   but keep routine patch-integrity checks internal unless the user asks. Let the
   user run `pnpm validate` locally.
8. The user prefers the current workflow: implement one coherent slice, provide
   the patch, wait for their `validate` result, then continue. Do not spend a long
   time exploring future features. When handing off a patch, link it and summarize
   its contents. Do not explain how to apply patches, or report `git diff --check` /
   `git apply --check`, unless the user asks. Include a one-line Conventional Commit
   message (for example `fix: ...` or `feat: ...`) in a code block after every
   patch handoff, inside a `git commit -m "..."` command.
9. Update this handoff whenever the current milestone or patch sequence changes,
   so the next no-context session does not need the conversation history.

## Project intent

kysoql is a TypeScript, Kysely-inspired query builder for Salesforce SOQL. The
safe API should remain SOQL-native and fully type-driven from generated
Salesforce Describe metadata.

Package boundaries are intentional:

- `@kysoql/core` owns schema types, immutable query ASTs, query builders, type
  inference, compilation, and the transport-neutral executor contract. It must
  stay JSforce-independent.
- `@kysoql/codegen` uses Salesforce Describe metadata to generate the schema
  consumed by core. It supports standard/custom objects and generated field /
  relationship metadata.
- `@kysoql/jsforce` is the JSforce transport/execution adapter. It validates
  external query/pagination payloads before handing records to core's executor
  abstraction.
- `@kysoql/debug` is a private, deliberately minimal TypeScript playground. It is
  not shipped to end users and does not need tsdown merely for consistency.

Follow Kysely's public API and immutable-AST architecture where it maps cleanly
to SOQL. Do not copy SQL-only semantics such as arbitrary joins.

## Current state after `v1.0.115`

The current continuation state includes all earlier work plus the following
recent patch sequence:

| Patch | Purpose |
| --- | --- |
| `v1.0.27` | Fix TypeScript `#/*` source alias resolution by mapping to `./src/*.ts`. |
| `v1.0.28` | Fix published-package source/build resolution using the `development` condition and Turbo dependency builds. |
| `v1.0.29` | Convert publishable `@kysoql/codegen` to tsdown, including its CLI entry. |
| `v1.0.30` | Convert publishable `@kysoql/jsforce` to tsdown and add root `pnpm t` as an alias of `pnpm test`. |
| `v1.0.31` | Validate JSforce `query` / `queryMore` payloads with Valibot. |
| `v1.0.32` | Normalize optional `nextRecordsUrl` for `exactOptionalPropertyTypes`. |
| `v1.0.33` | Add typed `OFFSET` with immutable AST, replacement semantics, compiler support, and Salesforce's `0..2000` bound. |
| `v1.0.34` | Add `ORDER BY ... NULLS FIRST|LAST`. |
| `v1.0.35` | Add grouped `OR` expression callbacks. |
| `v1.0.36` | Add nested grouped `AND` expression callbacks. |
| `v1.0.37` | Add logical `NOT` expressions. |
| `v1.0.38` | Add typed scalar-list `IN` / `NOT IN`. |
| `v1.0.39` | Keep negative `IN` type assertions compile-time-only so Vitest does not execute deliberately invalid calls. |
| `v1.0.40` | Add multi-select-picklist-specific `INCLUDES` / `EXCLUDES` using generated active picklist values; refresh this handoff. |
| `v1.0.41` | Add branded fixed relative date literals (`TODAY`, `YESTERDAY`, `TOMORROW`) for date/datetime filters. |
| `v1.0.42` | Extend `soqlRelativeDate(...)` with validated `LAST_N_DAYS:n` / `NEXT_N_DAYS:n` factory forms. |
| `v1.0.43` | Extend `soqlRelativeDate(...)` with validated `LAST_N_MONTHS:n` / `NEXT_N_MONTHS:n` factory forms. |
| `v1.0.44` | Add fixed `LAST_MONTH`, `THIS_MONTH`, and `NEXT_MONTH` relative-date literals. |
| `v1.0.45` | Add fixed `LAST_QUARTER`, `THIS_QUARTER`, and `NEXT_QUARTER` relative-date literals. |
| `v1.0.46` | Add fixed `LAST_YEAR`, `THIS_YEAR`, and `NEXT_YEAR` relative-date literals. |
| `v1.0.47` | Add fixed `LAST_FISCAL_YEAR`, `THIS_FISCAL_YEAR`, and `NEXT_FISCAL_YEAR` relative-date literals. |
| `v1.0.48` | Add fixed `LAST_FISCAL_QUARTER`, `THIS_FISCAL_QUARTER`, and `NEXT_FISCAL_QUARTER` relative-date literals. |
| `v1.0.49` | Add parameterized `LAST_N_FISCAL_QUARTERS:n` and `NEXT_N_FISCAL_QUARTERS:n` relative-date literals. |
| `v1.0.50` | Add parameterized `LAST_N_FISCAL_YEARS:n` and `NEXT_N_FISCAL_YEARS:n` relative-date literals. |
| `v1.0.51` | Complete documented relative-date literal support by grouping the remaining fixed week/90-day literals and parameterized calendar/fiscal families. |
| `v1.0.52` | Add typed child-to-parent relationship paths for selection, filtering, expression callbacks, and ordering with nested output typing. |
| `v1.0.53` | Add typed parent-to-child relationship subqueries with a dedicated immutable builder/AST, nested query-result typing, scalar child clauses, and API 58+ nested child traversal depth. |
| `v1.0.54` | Fix parent-to-child subquery builder return generics so accumulated nested output types satisfy `compile()` under strict TypeScript checking. |
| `v1.0.55` | Add typed SOQL semi-joins and anti-joins through `IN` / `NOT IN`, with a dedicated restricted subquery builder/AST and Salesforce nesting/compatibility limits. |
| `v1.0.56` | Fix the fifth-level relationship-subquery negative type assertion so it tests the rejected relationship without cascading through a `never` child builder. |
| `v1.0.57` | Add the typed aggregate-selection foundation: generated aggregateability metadata, aliased aggregate functions, scalar `COUNT()`, compiler support, and JSforce count execution. |
| `v1.0.58` | Add typed ordinary `GROUP BY`: immutable AST/compiler support, generated `groupable` gating, grouped-field selection/output typing, grouped ordering, and grouped `LIMIT`. |
| `v1.0.59` | Add typed grouped `HAVING`: immutable AST/compiler support, aggregate/grouped-field operands, logical composition, and semi/anti-join exclusion. |
| `v1.0.60` | Add typed `GROUP BY ROLLUP` / `CUBE`: advanced grouping modes, three-field limits, mode-mixing rejection, and nullable subtotal result fields. |
| `v1.0.61` | Complete typed `GROUPING(field)` for accumulated ROLLUP/CUBE fields in SELECT, HAVING, and ORDER BY, with exact `0 | 1` indicator output. |
| `v1.0.62` | Add the complete typed calendar/fiscal date grouping-function family with exact expression membership across ordinary GROUP BY, SELECT, HAVING, and ORDER BY. |
| `v1.0.63` | Restore the date-function node and parser source files that were omitted from the `v1.0.62` patch artifact. |
| `v1.0.64` | Add typed ordering by row-producing aggregate-function expressions on grouped queries, preserving field capabilities and excluding scalar `COUNT()`. |
| `v1.0.65` | Add typed aliased `toLabel()` selection for generated picklist/multipicklist fields in root and relationship-subquery SELECT lists. |
| `v1.0.66` | Add typed aliased `convertCurrency()` selection for generated currency fields in root and relationship-subquery SELECT lists. |
| `v1.0.67` | Migrate the codegen executable to oclif with explicit bundled command discovery, generated help, and typed repeatable flags. |
| `v1.0.68` | Add typed aliased `FORMAT()` selection for generated numeric/temporal fields and documented `FORMAT(convertCurrency(field))` composition. |
| `v1.0.69` | Complete typed `FORMAT()` aggregate composition for unaliased row-producing aggregate functions with field arguments. |
| `v1.0.70` | Add typed `FIELDS(STANDARD\|CUSTOM\|ALL)` selections, generated custom-field metadata, direct-field output inference, overlap protection, and REST/SOAP bounds. |
| `v1.0.71` | Add typed `convertTimezone()` composition inside date functions with datetime-only inputs and exact converted-expression grouping identity. |
| `v1.0.72` | Add typed geolocation fields plus validated `GEOLOCATION()` / `DISTANCE()` selection, filtering, and ordering with relationship/nullability preservation. |
| `v1.0.73` | Add Describe-driven typed polymorphic `TYPEOF` selection with branch-specific output unions, parent-path/nullability preservation, and function/grouping compatibility guards. |
| `v1.0.74` | Add Describe-driven typed top-level `USING SCOPE` with object-specific scope unions, immutable replacement semantics, and root compiler ordering. |
| `v1.0.75` | Add typed root `WITH DATA CATEGORY` filters with generated visible taxonomy unions, immutable multi-condition AST/compiler support, and Knowledge REST category discovery. |
| `v1.0.76` | Enforce Salesforce's Knowledge article `WITH DATA CATEGORY` prerequisite by requiring a root `WHERE` predicate on `PublishStatus` or `Id` for `KnowledgeArticleVersion` and `__kav` article types. |
| `v1.0.77` | Add Describe-driven typed root `FOR VIEW` / `FOR REFERENCE`, preserve MRU capability metadata, and document the stable JSforce boundary for automatic `Question` data-category discovery. |
| `v1.0.78` | Add Knowledge-article-only root `UPDATE TRACKING` / `UPDATE VIEWSTAT` with immutable accumulation, canonical combined compilation, and compiler/type gates. |
| `v1.0.79` | Add root-only typed `UserProfileFeed WITH UserId = ...`, immutable replacement, escaped scalar compilation, and the required-query compiler invariant. |
| `v1.0.80` | Enforce the documented root-WHERE filter prerequisites for `ContentDocumentLink` and `ContentHubItem` at the compiler boundary. |
| `v1.0.81` | Enforce the documented `Vote` root-WHERE predicate shapes, including operator/value-shape validation and literal-list-only `Id IN`. |
| `v1.0.82` | Enforce the coupled `UserRecordAccess` WHERE/SELECT/ORDER BY query shape, including the 200-record-ID bound and access-filter result restriction. |
| `v1.0.83` | Reject relationship-field `ORDER BY` expressions on `NewsFeed` and `UserProfileFeed` while leaving permission-dependent feed row caps to execution context. |
| `v1.0.84` | Enforce unconditional custom-metadata (`__mdt`) and external-object (`__x`) SOQL restrictions while leaving adapter-specific external-object behavior to execution context. |
| `v1.0.85` | Fix the supplied Biome check failures by applying formatter/import-order output, making the relationship `ORDER BY` scan return explicitly on every callback path, and excluding generated `*.generated.ts` fixtures from Biome checks. |
| `v1.0.86` | Fix the supplied TypeScript and Biome diagnostics by aligning the geolocation negative assertion with TypeScript 7's diagnostic location, removing stale/unused type plumbing, replacing banned empty-object spellings, and keeping TYPEOF runtime-boundary tests free of explicit `any`. |
| `v1.0.87` | Complete the final public-API/tooling/docs/codegen consistency audit: forward root `pnpm check` arguments through Turbo, remove the scaffold-only `kysoql()` export, complete package-entrypoint contract coverage, and make generated schema imports/empty metadata maps lint-friendly. |
| `v1.0.88` | Begin release hardening: standardize generated/schema empty maps on `Record<string, never>` without poisoning selection intersections, add typed publish-shape verification for built exports/declarations/binaries, and run it from `pnpm validate`. |
| `v1.0.89` | Add release metadata hardening: package-specific READMEs, explicit Node/public-access/tree-shaking/keyword metadata, an Unreleased changelog, and a typed verifier that keeps publishable package versions/metadata aligned. |
| `v1.0.90` | Add Salesforce QueryAll execution through root `.executeAll()` for record, aggregate-result, and bare-`COUNT()` queries, with optional transport-neutral executor hooks and JSforce v3 `scanAll` pagination. |
| `v1.0.91` | Fix the aggregate QueryAll executor test so its mock preserves the generic `QueryExecutor.executeAllQuery<O>()` contract under TypeScript 7/Vitest 5 instead of collapsing the return type to `unknown[]`. |
| `v1.0.92` | Add an explicit compile-only Apex query context and typed root record `FOR UPDATE`, with immutable AST/compiler support and rejection of the Salesforce-invalid `ORDER BY` combination. |
| `v1.0.93` | Add explicit Apex `WITH USER_MODE` / `WITH SYSTEM_MODE` access clauses with immutable replacement, competing-`WITH` rejection, and no inferred API-version default. |
| `v1.0.94` | Add typed Apex `WHERE` bind expressions with validated identifiers, scalar and `IN` / `NOT IN` collection typing, relationship-field support, and Knowledge/multipicklist guardrails. |
| `v1.0.95` | Complete the initial Apex bind ergonomics with grouped `WHERE` callbacks plus numeric `LIMIT` / `OFFSET` binds, preserving semi-join nesting rules and extending Knowledge bind rejection to pagination. |
| `v1.0.96` | Extend the terminal compile-only Apex context to aggregate-result and bare-`COUNT()` builders, reusing typed `WHERE`/pagination binds and access modes while keeping `FOR UPDATE` record-only. |
| `v1.0.97` | Fix the Apex aggregate regression fixture so `AnnualRevenue` explicitly carries the generated `aggregatable: true` capability required by typed `SUM()` selection. |
| `v1.0.98` | Correct the stale aggregate-HAVING bind plan against the current Apex bind grammar and add safe dotted `apexBind<T>` member paths such as `:record.Id` across the existing supported bind positions. |
| `v1.0.99` | Add Apex-only `WHERE` binds inside parent-to-child relationship subqueries, preserving child selection/output typing, function-mode/depth rules, and the existing no-semi-join boundary while keeping API-executable relationship subqueries bind-free. |
| `v1.0.100` | Add the documented Apex bind-left `INCLUDES` form across record, aggregate, bare-`COUNT()`, grouped-expression, and Apex relationship-subquery `WHERE` surfaces while preserving field-left right-hand-bind rejection. |
| `v1.0.101` | Add structured Apex `+` bind expressions through `apexAdd(...)`, using frozen addition/literal AST nodes with typed string or numeric operands while preserving the existing Apex-only bind-position and Knowledge-article guardrails. |
| `v1.0.102` | Add the documented structured Apex `String.substring(beginIndex, endIndex)` bind-expression family through `apexSubstring(...)`, with frozen method nodes, validated non-negative integer indexes, safe receiver composition, and no raw method-call escape hatch. |
| `v1.0.103` | Add the documented static-Apex query-result bind-expression family through `apexQueryField(...)`, storing a typed plain-mode nested select AST plus selected output key and explicit single-result cardinality while keeping nested query text builder-owned. |
| `v1.0.104` | Close the active roadmap with release hardening: verify exact source-barrel vs built runtime/declaration export parity for publishable packages, add a real-org static-Apex bind smoke fixture, run it from scratch-org setup, fix package README parity for `apexQueryField(...)`, and keep compile-only Apex type assertions Biome-clean without executing invalid calls. |
| `v1.0.105` | Fix TypeScript 7 release verification by replacing the removed root compiler-API dependency with a version-stable scanner for Kysoql's supported public ESM / declaration export grammar while preserving exact source/build parity checks. |
| `v1.0.106` | Harden the TypeScript-7 publish export scanner with direct Vitest coverage and correct type-only handling for `export default interface`, while keeping direct Node execution through explicit `.ts` script imports. |
| `v1.0.107` | Make validation explicitly type-check source and test code as separate phases, including package Vitest suites, root test tooling, and the generated Salesforce TypeScript fixture. |
| `v1.0.108` | Fix codegen for repeated Salesforce child-relationship names by emitting one property whose type is the exact union of the concrete relationship metadata pairs; refresh the real-org fixture so test typechecking succeeds. |
| `v1.0.109` | Align VS Code/tsserver with CLI test typechecking by moving test projects to editor-discoverable `tsconfig.json` files under each test tree and making `typecheck:test` compile those same projects. |
| `v1.0.110` | Align VS Code with the repository-pinned TypeScript SDK and make Apex negative type assertions insensitive to compiler-version diagnostic span changes. |
| `v1.0.111` | Add typed SOQL date-function predicates to ordinary `WHERE` expression callbacks, using generated `filterable` date/datetime metadata, typed operator/RHS constraints, and supported `convertTimezone()` composition without requiring `groupable`. |
| `v1.0.112` | Fix the strict `FIELDS(CUSTOM)` output regression assertion to include the two custom date fields introduced by `v1.0.111`, keeping the fixture type-complete under `pnpm typecheck:test`. |
| `v1.0.113` | Fix the date-function `WHERE` compiler regression expectation to follow the established compiler formatting contract: top-level `AND` expressions do not receive redundant outer parentheses. |
| `v1.0.114` | Add typed `toLabel()` predicates to ordinary `WHERE` callbacks with filterable generated picklist metadata, translated-string/nullability-aware operands, regular-picklist `LIKE`, child-to-parent paths, and Salesforce's documented `Division` / `CurrencyIsoCode` / external-object restrictions. |
| `v1.0.115` | Keep negative `toLabel()` WHERE type assertions compile-time-only after invalid function calls so strict test typechecking does not cascade diagnostics through deliberately-invalid expressions. |

### Build/tooling state

- Workspace targets Node 26, pnpm, Turborepo, TypeScript 7, Vitest, Biome, and
  tsdown.
- `@kysoql/core`, `@kysoql/codegen`, and `@kysoql/jsforce` are publishable and
  build with tsdown.
- `@kysoql/codegen` uses `@oclif/core` with explicit command discovery so its
  bundled `commands.mjs` registry remains compatible with tsdown; `generate` is
  a real oclif command, while the package's normal library entry remains
  independent of CLI runtime code.
- `@kysoql/debug` is private and intentionally remains a simple `tsc`-built
  playground.
- Root `pnpm test` and `pnpm t` both run `vitest run`.
- Root `pnpm check` forwards trailing arguments through Turbo, so
  `pnpm check --write` reaches every package-level `biome check` task.
- `pnpm validate` is the required validation gate: source TypeScript typecheck,
  test TypeScript typecheck, Vitest, package builds, publish-shape verification,
  then release-metadata verification.
  The publish verifier checks `@kysoql/core`, `@kysoql/codegen`, and
  `@kysoql/jsforce` built exports, matching declaration files, and any declared CLI
  binaries. The release verifier keeps public package versions aligned with the
  workspace, enforces explicit Node/public-access/tree-shaking/keyword metadata,
  checks package READMEs, and requires an Unreleased changelog section. Biome is
  intentionally separate under `pnpm check`.
- Test/editor TypeScript projects use conventional discoverable names: each
  `packages/*/tests/` directory has its own `tsconfig.json`, as do root `scripts/`
  and `test/`; root `tsconfig.json` covers `vitest.config.ts`. Package
  `typecheck:test` scripts compile the same `tests/tsconfig.json` that VS Code
  discovers, so editor diagnostics and CLI validation use the same strict options
  and `#/*` source aliases.

### Package import/export convention

Inside a package, TypeScript source uses `#/...`, never new relative `./` / `../`
imports. Each package maps source imports in TypeScript like this:

```json
{
  "compilerOptions": {
    "paths": {
      "#/*": ["./src/*.ts"]
    }
  }
}
```

Publishable packages use package imports/exports with a named `development`
condition pointing at source and a normal/default condition pointing at built
`dist` output. Their tsdown configs use:

```ts
exports: {
  devExports: "development",
}
```

`@kysoql/codegen` additionally has separate library, executable, and oclif
command-registry entries and keeps the CLI-only entries out of package exports.
Cross-package imports always use workspace package names such as
`@kysoql/core`; never reach into another package's `src` or `dist`.

Generated/schema metadata uses `Record<string, never>` for genuinely empty maps.
Because that type is not a neutral intersection identity, query-selection
accumulators start from `unknown` instead; do not replace those accumulator
identities with `Record<string, never>`. `NonNeverStringKey<T>` normalizes the
empty-map convention so generated empty fields/relationships/categories do not
become arbitrary string keys.

### Core query surface currently implemented

Core currently has:

- `Kysoql<DB> -> QueryCreator<DB> -> SelectQueryBuilder<DB, TB, O>`;
- immutable builders and frozen operation nodes;
- typed `selectFrom()` and additive `.select()` with selected-output accumulation;
- typed child-to-parent dotted field paths derived lazily from generated parent
  metadata, available in selection/filtering/ordering up to Salesforce's five-level
  traversal limit; related selections infer nested output objects and lookup
  nullability; traversed target objects must be present in the generated schema;
- typed `.selectTypeOf(relationship, callback)` for Describe-confirmed polymorphic
  parent relationships, including child-to-parent target paths; generated
  `referenceTo`, `namePointing`, and `polymorphicForeignKey` metadata constrain
  valid targets and `WHEN` objects, branch fields are typed against the referenced
  objects, output unions are discriminated by Salesforce record `attributes.type`,
  and parent/unmatched-type nullability is preserved; typed `ELSE` currently uses
  the common field/path surface of all remaining generated targets, and TYPEOF is
  kept incompatible with SELECT functions (including nested child subqueries),
  aggregate/grouping forms, and ordinary field selection through the same target;
- typed root `.usingScope(scope)` from each object's generated Describe
  `supportedScopes`; record, aggregate, and scalar `COUNT()` builders retain the
  capability, repeated calls replace the previous immutable scope node, and the
  compiler emits the clause after `FROM` and before `WHERE` / grouping / ordering;
  relationship-subquery builders intentionally omit the method because Salesforce
  disallows `USING SCOPE` in parent-child relationship queries;
- typed root `.forView()` / `.forReference()` recent-usage clauses gated by each
  object's generated Describe `mruEnabled` capability when known; record, aggregate,
  and scalar `COUNT()` root builders preserve the clause, repeated calls replace the
  prior mode, and the compiler emits it after `OFFSET`; older hand-written schemas
  whose MRU capability is unknown remain permissive, while relationship-subquery
  builders intentionally omit both methods;
- typed root `.updateTracking()` / `.updateViewstat()` Knowledge usage clauses,
  available only on `KnowledgeArticleVersion` and specific `__kav` article types;
  record, aggregate, and scalar `COUNT()` root builders preserve the clause, repeated
  calls accumulate without duplicates, the compiler normalizes the combined form to
  `UPDATE TRACKING, VIEWSTAT` after any `FOR VIEW` / `FOR REFERENCE` clause, and a
  compiler-boundary object-family check protects unsafe/manual ASTs; relationship
  subqueries intentionally omit both methods;
- typed root `.withDataCategory(group, selector, categoryOrCategories)` from
  generated object-specific data-category maps; category groups/categories are
  constrained to the visible generated taxonomy, category lists are non-empty,
  selectors cover `AT` / `ABOVE` / `BELOW` / `ABOVE_OR_BELOW`, and immutable
  accumulation plus compiler validation enforce Salesforce's maximum-three and
  unique-group rules; the CLI discovers the full visible Knowledge tree through
  REST for `KnowledgeArticleVersion` / `__kav` targets, while Question discovery
  remains an optional codegen-client integration because the REST resource only
  accepts `KnowledgeArticleVersion`; relationship subqueries omit the method;
- typed `.selectFields("standard" | "custom" | "all")` on record and
  relationship-subquery builders; generated `custom` metadata expands exact
  direct-field result shapes, compile-time guards reject overlap with explicit
  direct selections in either call order, and compiler validation requires
  `LIMIT <= 200` for REST/SOAP `CUSTOM` / `ALL` queries;
- typed `.selectSubquery(childRelationship, callback)` parent-to-child queries
  derived lazily from generated `children` metadata; child builders support typed
  scalar selections, child-to-parent paths, `where` expression callbacks,
  `orderBy`, and `limit`, plus nested child subqueries through four child
  traversals below the root (five total REST/SOAP query levels); selected child
  relationships infer `SalesforceQueryResult<Row>` envelopes with `totalSize`,
  `done`, `records`, and optional `nextRecordsUrl`; subquery `OFFSET` is omitted
  because Salesforce still documents it as a conditional pilot feature;
- typed semi-joins and anti-joins by passing a subquery callback to `IN` /
  `NOT IN`; the outer operand is restricted to a direct filterable ID/reference
  field, the inner query selects exactly one compatible direct ID/reference
  field, generated `referenceTo` domains drive compatibility (including
  polymorphic references), and the inner builder intentionally exposes only
  scalar filtering plus its single selection; self semi-joins, unsupported
  Salesforce objects/tag objects, relationship-subquery use, nested semi-joins,
  `OR` / logical `NOT` nesting, and more than two semi/anti-join terms are
  rejected;
- typed aggregate selection through `.select(({ fn }) => ...)` for aliased
  `COUNT(field)`, `COUNT_DISTINCT(field)`, `SUM(field)`, `AVG(field)`,
  `MIN(field)`, and `MAX(field)` expressions; generated `aggregatable` metadata
  gates aggregate-capable fields and `SUM` / `AVG` additionally require numeric
  Salesforce field types; aggregate output keys and value/nullability types are
  inferred from aliases and terminal field metadata;
- additive typed `.groupBy(...)` on row-producing aggregate queries, restricted
  to generated `groupable: true` field references including supported
  child-to-parent paths; grouped ordinary `.select(...)` fields must already be
  members of the accumulated grouping set and contribute their normal nested
  selection shape to the aggregate output; grouped queries can order by grouped
  sortable fields and use `LIMIT`;
- typed additive `.groupByRollup(...)` and `.groupByCube(...)` modes with the same
  generated `groupable` gating; ordinary / ROLLUP / CUBE forms cannot be mixed,
  advanced modes enforce Salesforce's cumulative three-field limit, and selected
  advanced-grouping fields gain leaf nullability for subtotal/grand-total rows
  without weakening ordinary GROUP BY result types; existing grouped selection,
  `HAVING`, grouped ordering, and `LIMIT` remain available across these modes;
- typed additive `.having(...)` on grouped aggregate queries; direct field
  operands must belong to the accumulated grouping set, while callback operands
  can use unaliased aggregate functions through `eb.fn`; HAVING callbacks support
  typed `and` / `or` / `not` composition, aggregate comparison values preserve
  field-aware semantics where needed, semi/anti-join operands are excluded, and
  repeated `.having(...)` calls combine with `AND`;
- typed `GROUPING(field)` for exactly the accumulated `ROLLUP` / `CUBE` field set;
  the function is unavailable before advanced grouping and on ordinary `GROUP BY`,
  aliased SELECT output and HAVING values use the exact `0 | 1` indicator type,
  and focused expression callbacks support documented GROUPING ordering without
  exposing broader aggregate-expression ordering;
- typed date grouping functions for the complete documented calendar/fiscal
  family through `.groupBy(({ fn }) => ...)`; generated temporal/groupable
  metadata gates inputs (including child-to-parent references), `DAY_ONLY` and
  `HOUR_IN_DAY` are datetime-only, aliased outputs preserve temporal and
  relationship nullability, and exact function membership is retained across
  ordinary GROUP BY, SELECT, HAVING, and ORDER BY; datetime inputs can be
  explicitly wrapped with `convertTimezone()` inside those functions while
  retaining a distinct exact identity; ROLLUP/CUBE remain field-only;
- typed aggregate-expression ordering after grouping for unaliased
  `COUNT(field)`, `COUNT_DISTINCT(field)`, `AVG(field)`, `MIN(field)`,
  `MAX(field)`, and `SUM(field)` callbacks, including direction and explicit
  null placement without requiring the expression to be selected; generated
  aggregateability and numeric constraints remain intact, while scalar
  `COUNT()` stays excluded;
- typed aliased `toLabel()` selection on record and relationship-subquery
  builders for generated picklist/multipicklist fields, including
  child-to-parent references; translated outputs are strings with propagated
  field/relationship nullability, while unsupported ordering and non-picklist
  inputs remain outside the public type surface;
- typed aliased `convertCurrency()` selection on record and
  relationship-subquery builders for generated currency fields, including
  child-to-parent references; converted outputs remain numeric with propagated
  field/relationship nullability, the multiple-currencies org prerequisite is
  documented rather than falsely inferred from field metadata, and unsupported
  aggregate inputs, filtering, and expression ordering remain outside the public
  type surface;
- typed aliased `FORMAT()` selection on record and relationship-subquery
  builders for generated number, currency, date, datetime, and time fields,
  including child-to-parent references; localized outputs are strings with
  propagated field/relationship nullability, and the documented
  `FORMAT(convertCurrency(field))` composition reuses the existing unaliased
  currency builder; aggregate queries can also format unaliased row-producing
  field aggregates while preserving aggregate nullability, with bare `COUNT()`,
  aliased inputs, `GROUPING()` indicators, filtering, and ordering excluded;
- generated `location` fields as structured `SalesforceGeolocation` values plus
  typed `GEOLOCATION()` / `DISTANCE()` expressions on record and relationship
  subqueries; fixed coordinates are validated, distance SELECT output is
  aliased and nullability-aware, filters are restricted to `<` / `>`, and
  distance ordering preserves generated filterable/sortable relationship-path
  capabilities while direct scalar comparison, aggregation, grouping, and
  ordinary field ordering remain closed;
- bare `COUNT()` as a dedicated scalar `CountQueryBuilder` with scalar `WHERE`
  and `LIMIT`; it compiles independently from row-producing aggregates and uses
  the executor's optional `executeCountQuery` capability, implemented by the
  JSforce adapter from a validated `totalSize` response;
- field-aware `.where(field, operator, value)` plus expression callbacks;
- equality, ordered comparisons, lowercase `like`, scalar-list `in` / `not in`,
  and multipicklist `includes` / `excludes`;
- explicit `soqlDate(...)`, `soqlDateTime(...)`, and `soqlTime(...)` absolute
  temporal filter literals;
- branded `soqlRelativeDate(...)` support for all documented Salesforce
  relative-date literals on `date` / `datetime` filters, including fixed
  day/week/month/quarter/year/fiscal ranges, `LAST_90_DAYS` / `NEXT_90_DAYS`,
  `LAST_N_*` / `NEXT_N_*`,
  and `N_*_AGO` calendar/fiscal families; parameter counts are validated as
  non-negative safe integers and all literals compile unquoted;
- grouped `eb.or([...])`, grouped/nested `eb.and([...])`, and `eb.not(expr)`;
- typed additive `.orderBy(...)` for scalar fields, grouped fields, exact grouped
  date functions, advanced `GROUPING(field)`, and grouped row-producing
  aggregate expressions;
- `.limit(number)` with non-negative safe-integer validation and replacement on
  repeated calls;
- `.offset(number)` with integer `0..2000` validation and replacement on repeated
  calls;
- `CompiledQuery<O>`, compiler output, transport-neutral execution, and the
  JSforce adapter with full explicit pagination, scalar bare-`COUNT()` execution,
  and QueryAll execution for soft-deleted/archived records through root
  `.executeAll()`; JSforce v3 uses `query(soql, { scanAll: true })` for the first
  page and ordinary `queryMore` locators thereafter;
- an explicit terminal `.apex()` context on root record, aggregate-result, and
  scalar bare-`COUNT()` queries; every Apex-context builder is compile-only,
  exposes explicit `.withUserMode()` / `.withSystemMode()` access clauses plus
  typed direct/grouped `.where(...)` binds through `apexBind<T>(expression)`, and
  keeps ordinary REST/JSforce execution methods unavailable; record queries
  additionally expose `.forUpdate()` plus numeric bind support for `.limit(...)` /
  `.offset(...)`, aggregate-result queries reuse the same pagination surface
  without locking, and bare `COUNT()` keeps its existing `LIMIT`-only shape;
  scalar binds follow generated field/relationship value types, `IN` / `NOT IN`
  binds require readonly collections, grouped callbacks retain `and` / `or` /
  `not` composition and existing semi-join nesting rules, row-producing Apex
  queries can add parent-to-child `.selectSubquery(...)` selections whose child
  `WHERE` clauses use the same bind types while retaining the relationship
  subquery no-semi-join rule, and bind expressions are restricted to simple
  identifiers or dotted member paths (for example `record.Id`) rather than
  arbitrary Apex/raw-SOQL fragments; ordinary REST/JSforce builders expose none
  of those Apex forms; Salesforce's documented bind-left multipicklist syntax is
  exposed separately as `where(apexBind<string>(...), "includes",
  literalValues)`, while structured `+` bind expressions use `apexAdd(...)` with
  same-family string or numeric operands and frozen Apex-expression AST nodes;
  structured string substring expressions use `apexSubstring(...)` with a
  string-valued receiver plus validated non-negative integer bounds; structured
  nested query-result field expressions use `apexQueryField(...)` with a plain-mode
  Apex builder, selected output key, and explicit single-result AST cardinality; raw
  arithmetic, arbitrary method-call text, and raw nested-query strings remain
  rejected by `apexBind(...)`, and the type/parser surface
  continues to reject right-hand bind values for field-left `INCLUDES` /
  `EXCLUDES`; compilation rejects
  `ORDER BY` on locking queries,
  competing `WITH` filtering forms alongside an Apex access mode, and
  Knowledge-article Apex binds in either filters or pagination; the current Apex
  bind-expression guide does not document static binds in `HAVING`, so Kysoql does
  not expose that previously planned form;
- generated field metadata for filterable/sortable/groupable/aggregatable/custom
  flags, polymorphic-reference detection (`namePointing`,
  `polymorphicForeignKey`, and `referenceTo`), active picklist values, and
  parent/child relationships, plus object-level `supportedScopes` unions,
  visible data-category group/category unions, and `mruEnabled` capability flags.

Important current filter typing rules:

- operators remain constrained by Salesforce field type/capability metadata;
- `IN` / `NOT IN` accept typed non-empty readonly value lists and, for direct
  filterable ID/reference fields, typed semi/anti-join subquery callbacks;
- the ordinary field-left `INCLUDES` / `EXCLUDES` form is available only on
  generated `multipicklist` fields and its list members are constrained to the
  field's generated active picklist-value union; the separate Apex-only bind-left
  form accepts a string-valued bind plus literal strings;
- negative compile-time assertions that would intentionally throw at runtime
  should be placed inside an uninvoked function in Vitest files.

## Current next slice

**The follow-on SOQL completeness pass is active through `v1.0.115`.**
`v1.0.104` closes the release-audit gap rather than adding more SOQL grammar,
`v1.0.105` repairs that verifier for TypeScript 7, whose package root no longer
exposes the historical compiler API, `v1.0.106` adds direct scanner regression
coverage while correcting type-only default-interface runtime classification, and
`v1.0.107` closes the validation gap by making source and test typechecking explicit
phases of the root typecheck gate. `v1.0.108` fixes the first real regression exposed
by that gate: some real-org Describe metadata repeats a child `relationshipName` for
multiple foreign-key fields. Codegen now groups those rows under one property and
preserves every concrete child-object / field pair as a union instead of emitting
duplicate TypeScript property declarations. `v1.0.109` then aligns editor and CLI
project discovery: test directories now contain conventional `tsconfig.json` files,
and package `typecheck:test` scripts compile those exact configs so VS Code no longer
falls back to an inferred project without the package `#/*` aliases. `v1.0.110`
closes the remaining editor/CLI drift: the workspace points VS Code at the pinned
TypeScript SDK, and multiline negative Apex assertions no longer place
`@ts-expect-error` inside an argument list where compiler versions can disagree
about the diagnostic span. A subsequent SOQL completeness audit found that date
functions were still exposed only through grouping/HAVING-oriented expression
surfaces even though Salesforce also supports them in ordinary filters.
`v1.0.111` closes that gap: `WHERE` callbacks expose the complete thirteen-function
date family, use generated `filterable` temporal metadata rather than `groupable`,
preserve numeric/date operand typing, and support `convertTimezone()` around
filterable datetime fields. `v1.0.112` fixes the strict `FIELDS(CUSTOM)`
regression assertion exposed by that fixture expansion: the two custom date fields
used to distinguish filterable/non-groupable and non-filterable metadata are real
custom fields and therefore must also appear in the inferred `FIELDS(CUSTOM)` output.
`v1.0.113` then fixes the new date-function compiler regression expectation
itself: the compiler intentionally omits redundant parentheses around a top-level
`AND`, matching the established boolean-expression formatting contract used by
adjacent compiler tests. `v1.0.114` closes the next ordinary-filter gap: `WHERE`
callbacks now expose a dedicated `fn.toLabel(...)` expression for generated
filterable picklist/multipicklist fields and parent paths. The filter uses
translated string operands instead of API-name unions, preserves nullable
equality, exposes `LIKE` only for regular picklists, statically excludes
`Division` / `CurrencyIsoCode`, and extends the external-object compiler guard to
reject `toLabel()` in `WHERE` as well as SELECT.

`v1.0.115` fixes the negative `toLabel()` type-test shape: invalid `fn.toLabel(...)`
calls are asserted in isolation and are not then reused in a second expression, which
prevents expected invalid values from producing unsuppressed cascading diagnostics.
`pnpm verify:publish` treats each publishable package's `src/index.ts` barrel as the
public contract and compares it with both the built runtime named exports and the
generated declaration exports after build. This
catches source-only exports, build-only exports, and declaration drift before
publish without depending on TypeScript's programmatic AST surface.

The Salesforce DX fixture now includes `scripts/apex/static-bind-smoke.apex`, which
executes the representative static-Apex bind forms modeled by the completed Apex
AST: scalar / collection / dotted-member binds, bind-left `INCLUDES`,
relationship-subquery binds, structured addition, structured substring, query-result field access, and bound
`LIMIT` / `OFFSET`. `pnpm salesforce:setup` runs it automatically after seeding,
and `pnpm salesforce:apex-binds` reruns it against an existing authenticated org.
The real-org fixture intentionally remains outside `pnpm validate` so local release
validation never requires Salesforce credentials.

The next coherent SOQL slice is `v1.0.116`: add compiler validation for
Salesforce relationship-count limits (20 parent-to-child subqueries and 55
child-to-parent relationships), taking care to count repeated paths correctly
rather than simply counting reference nodes. Do not fold the slice into unrelated
Apex/static-bind work.

The `v1.0.84` specialist-object boundary remains unchanged: keep Big Object index
validation, Data 360 relationship/query rules, external-object adapter-specific
limits, and other permission/cardinality-dependent caps as execution-context
concerns. Automatic `Question` data-category taxonomy discovery remains deferred
until a stable public JSforce/Salesforce transport path exists.

## Follow-on roadmap after the consistency audit

The general REST/SOAP SOQL builder is now substantially complete. Remaining work
should be treated as separate follow-on tracks rather than folded into the final
consistency audit:

1. **Relationship-count validation.** Enforce Salesforce's documented 20
   parent-to-child and 55 child-to-parent relationship limits at the compiler
   boundary with path-aware counting.
2. **Data-category transport support when a stable path exists.** The public
   codegen hook already accepts normalized `Question` taxonomy metadata; do not
   use JSforce's private SOAP invocation machinery solely to automate it.
3. **Execution-context-specific syntax.** Re-evaluate `FOR UPDATE`,
   `WITH USER_MODE`, nested bind positions, and related Apex-context behavior
   separately from the transport-neutral REST/JSforce core. Do not reintroduce
   retired `WITH SECURITY_ENFORCED` syntax.
4. **Capability-rich specialist objects.** Big-object index validation, Data 360
   object rules, external-adapter-specific limits, and permission/cardinality
   dependent caps need authoritative metadata or execution-context hooks before
   they can become sound static/compiler guarantees.
5. **Release hardening.** The baseline audit is complete through `v1.0.115`: built
   runtime/declaration export parity is verified against source barrels without
   depending on TypeScript's removed root compiler API, and the scratch-org fixture
   exercises the completed static-Apex bind-expression families. Continue only for
   concrete API/package defects or additional real-org regressions discovered by
   validation or publishing.

The aggregate-selection, grouping/HAVING, relationship traversal, polymorphic
selection, function-expression, pagination, scope/category, MRU, Knowledge,
UserProfileFeed, ContentDocumentLink, ContentHubItem, Vote, UserRecordAccess,
feed-ordering, custom-metadata, and universal external-object foundations are in
place.

## Validation and runtime-boundary conventions

Preferred local validation after every patch:

```bash
pnpm validate
```

`pnpm typecheck` runs explicit source and test phases. Package Vitest files are
checked with the same editor-discoverable `packages/*/tests/tsconfig.json` projects
that VS Code loads. Root `scripts/`, `test/`, and `vitest.config.ts` likewise have
conventional `tsconfig.json` projects, preventing inferred-project diagnostics from
drifting away from CLI validation. `.vscode/settings.json` points the editor at
`node_modules/typescript/lib`; after install, select the workspace TypeScript
version once in VS Code so editor diagnostics use the same pinned compiler as the
CLI. Keep negative `@ts-expect-error` assertions on the line immediately before a
complete invalid statement rather than inside a multiline argument list.

Formatting/linting is separate:

```bash
pnpm check
pnpm check --write
```

Release metadata can also be checked independently of the build:

```bash
pnpm verify:release
```

Salesforce fixture/schema commands require an authenticated org and remain
separate:

```bash
pnpm salesforce:setup
pnpm salesforce:schema -- \
  --object Account \
  --object Kysoql_Record__c \
  --output test/salesforce/salesforce.generated.ts
```

Never commit or print Salesforce access tokens.

Use Valibot at genuine external/runtime boundaries: CLI/env input, Salesforce
Describe/query payloads, transport pagination payloads, numeric builder inputs,
and explicit literal factories. Prefer the namespace import:

```ts
import * as v from "valibot";
```

For fallible external inputs, prefer `v.safeParse(...)`; use
`v.summarize(result.issues)` when a human-readable validation summary is useful.
Do not force Valibot onto impossible internal AST/compiler states that represent
programmer errors.

## Design invariants to preserve

- immutable builder cloning and frozen AST nodes;
- repeated top-level `.where()` calls combine with `AND`;
- expression callbacks preserve precedence explicitly through the AST/compiler;
- filter/order/group capability checks come from generated Salesforce metadata;
- operator availability remains Salesforce-field-type-aware;
- builder spelling follows Kysely-style lowercase operators/directions where
  appropriate; compiler output uses SOQL spelling/casing;
- `.select()` output typing continues to accumulate through `O & Selection<...>`;
- `.compile()` preserves the selected output type through `CompiledQuery<O>`;
- result temporal values remain strings, while filter temporal literals are
  explicit typed wrappers;
- execution remains transport-neutral in core;
- JSforce execution never silently truncates paginated results;
- no raw SOQL escape hatch in the safe API;
- no arbitrary SQL joins;
- `@kysoql/core` never imports JSforce;
- do not add checked-in generated JavaScript source where ignored `dist/` output
  is sufficient.

## Patch creation discipline

Patches are generated against the immediately preceding complete state. Do not
rewrite an older artifact once handed off. Every feature, fix, test-only patch,
docs patch, or configuration patch consumes the next version exactly once.

For a future project-bundle handoff, first commit the repository state because
`git bundle` excludes uncommitted changes:

```bash
git status
git bundle create project.bundle --all
```

When a fresh bundle is supplied later, inspect it first. This document describes
intent/current continuation state but must not override newer code in the bundle.
