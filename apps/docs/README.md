# Kysoql documentation

The user documentation for the Salesforce Query Builder lives in
`content/docs`. This app uses the existing TanStack Start and Fumadocs stack;
MDX content drives navigation, search, Markdown exports, and the language-model
indexes. It does not connect to Salesforce or require Salesforce credentials.

## Run locally

Use the repository's declared toolchain: Node.js `26.10.0` (`.node-version`) and
pnpm `12.5.1` (`packageManager`). From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter docs dev
```

Open the local URL printed by Vite. To build and preview:

```bash
pnpm --filter docs build
pnpm --filter docs preview
```

Do not use a globally installed, different TypeScript version as a replacement
for the workspace's pinned toolchain when investigating type errors.

## Content structure

| Root | Purpose |
| --- | --- |
| `framework/` | Framework-level usage: setup, query building, and common Salesforce concepts. |
| `core/` | `@kysoql/core`: Apex compilation, schema/result types, advanced features, and core references. |
| `rest/` | `@kysoql/rest`: native execution, pagination, token-provider integration, and REST API reference. |
| `auth/` | `@kysoql/auth`: private-key JWT bearer first, flow-specific OAuth guides, and refresh-token storage. |
| `codegen/` | `@kysoql/codegen`: configuration, schema generation, field filtering, and codegen API reference. |
| `jsforce/` | `@kysoql/jsforce`: the optional JSforce adapter and its API reference. |

`framework/`, `core/`, `rest/`, `auth/`, `codegen/`, and `jsforce/` are peer Fumadocs
root folders (`"root": true`). The layout root toggle therefore stays available
while browsing Framework or any individual package; no package root is nested
inside another. `/docs` redirects to the Framework root by default. Each root has
a `meta.json` with an explicit `pages` array; add new pages there rather than
relying on alphabetical ordering. Keep package-specific pages inside the matching
root so navigation and search filtering stay aligned.

### Generated API reference

The package API-reference pages are generated from each package's public
`src/index.ts` entry point with TypeDoc and `typedoc-plugin-markdown`. The shared
configuration in `typedoc/config.ts` emits MDX directly into the existing
Fumadocs content routes and uses table layouts for indexes, parameters, and
public properties. `typedoc-plugin-frontmatter` only supplies the page metadata
required by this app; there are no custom conversion or reflection plugins.

Generate every package or one package at a time:

```bash
pnpm --filter docs docs:api
pnpm --filter docs docs:api:core
pnpm --filter docs docs:api:rest
pnpm --filter docs docs:api:auth
pnpm --filter docs docs:api:codegen
pnpm --filter docs docs:api:jsforce
```

The generated `api.mdx` files are ignored by Git and are recreated before docs
`dev`, `build`, and content validation. TypeScript example validation skips these
pages because TypeDoc signature blocks are API declarations, not standalone
consumer examples.

## Authoring conventions

Start each page with JSON-quoted YAML frontmatter:

```yaml
---
title: "Page title"
description: "Explain what the reader will accomplish."
---
```

Use H2 and lower headings in the body; the page layout renders the H1 from
`title`. Use descriptive headings, language-tagged code fences, descriptive link
text, and absolute internal links such as `/docs/framework/guides/filtering`. Use stable
heading anchors for deep links. Tables work well for signatures and capability
comparisons; explain decisions and caveats in prose.

Write complete, independently typecheckable `ts`/`typescript` (or `tsx`) blocks.
Fumadocs metadata such as `title="src/db.ts"` and line highlights is supported.
The shared parser keeps that metadata separate from the language; aliases are
normalised before examples are extracted. Shared query examples
import `db` from `./db` and generated types from `./salesforce.generated`;
the quickstart explains how readers create those files. Local imports must not
include `.js`; content checks enforce this. The quickstart uses `tsx`, and
example typechecking uses `ESNext`/`Bundler` resolution with no emit. Do not add a
plain `tsc`-then-Node workflow that cannot resolve extensionless imports. Show
prerequisites for custom fields, object metadata, and feature availability. Use `text` for output,
`sql` for SOQL, and `apex` for Apex examples; do not label partial or invalid
pseudo-code as executable TypeScript.

For consumer package installation, write one `npm` code fence with npm syntax.
Fumadocs' npm remark plugin expands it into npm, pnpm, yarn, and bun tabs, and
`source.config.ts` persists the selected package manager under the shared
`package-manager` group. Keep repository-only commands in pnpm when they depend
on this monorepo's pinned pnpm workspace.

Document the source as it exists, not planned methods. Check changes against
`packages/core/src/index.ts`, the builders/compiler, codegen, and adapter tests.
Describe Kysoql as a **Kysely-inspired query builder for Salesforce SOQL**. Do not
describe it as Kysely-compatible, a Kysely dialect, or a SQL abstraction; Kysely
inspires parts of the TypeScript API while Salesforce SOQL defines query
semantics. Keep API execution, static Apex, and dynamic Apex capabilities
separate. Never imply that `executeAll()` means ordinary pagination, that
generated types enforce permissions, or that the adapter validates every selected
field value.

The assumed package scope is `@kysoql`, matching the manifests. Keep installation
instructions honest about the repository's `0.0.0` versions and unpublished
workspace use. Never claim registry availability or a minimum TypeScript
version that the repository does not declare. Mark beta/pilot features and link
to the relevant official Salesforce documentation instead of promising universal
org support.

## Validate changes

Run the workspace source check from the repository root, or use Turbo to check
only docs with its dependency builds:

```bash
pnpm typecheck:source
# Docs only, including its library build prerequisites:
pnpm exec turbo run typecheck:source --filter=docs
```

Both commands schedule library builds before the docs checks. Package-local
commands below bypass Turbo; for standalone example checks, build the libraries
first so the docs exercise their public declaration files:

```bash
pnpm exec turbo run build --filter=@kysoql/core --filter=@kysoql/rest --filter=@kysoql/auth --filter=@kysoql/jsforce --filter=@kysoql/codegen
pnpm --filter docs check:content
pnpm --filter docs check:examples
pnpm --filter docs types:check
pnpm --filter docs build
```

`pnpm --filter docs typecheck:source` combines content checks, example
typechecks, and site typechecks but does not build dependencies itself. The same
script participates in the workspace's source-typecheck task through Turbo.
The workspace lint command for this app remains `pnpm --filter docs check`.

### Content validation

`check:content` first regenerates the TypeDoc API pages, then runs the shared
parser's `node:test` regression suite and the content checker. The parser and
checker themselves use only Node.js built-ins. They check frontmatter,
duplicate routes/titles, balanced and labelled code fences, JSON examples, internal page
and heading links, starter placeholders, and navigation coverage. The checker
supports the site's explicit navigation entries and JSON-quoted frontmatter;
update it deliberately if introducing other Fumadocs metadata conventions.

This is a structural check, not an MDX compiler or external-link availability
checker. The site build and browser review are still required. After building,
check desktop and mobile navigation, search, long code/table overflow, page
titles, the copy-Markdown control, and direct/deep links.

### Example typechecks

`check:examples` extracts every `ts`, `typescript`, and `tsx` fence (including
fences with metadata) to a separate module in the ignored
`.generated/examples/` directory. It copies `examples/db.ts` and
`examples/salesforce.generated.ts`, then runs the installed `tsc` with strict
null checking, exact optional properties, and unchecked-index protection.

It resolves `@kysoql/*` through their built public package exports and resolves
JSforce through its adapter workspace. Each source package has its own `#/*`
path mapping, so those sources must not be flattened into one docs compiler
project. No custom development export condition is used for consumer examples.

The docs declare workspace development dependencies on all five packages, so
the root Turbo source-typecheck task builds them before checking examples. For a
standalone check, use the build command above. Missing declarations produce an
actionable error rather than falling back to incomplete source resolution.
A complete workspace dependency installation is also required. The generated
`manifest.json` maps each example filename to its MDX page and first code line.
Diagnostic line 1 is that first code line; add the diagnostic line minus one to
find its location in the original page.

If declarations disappear during a Turbo run after a successful build or cache
restore, check for a consumer script that rebuilds or cleans a dependency.
`tsdown` cleans `dist/` before building; a nested rebuild can remove files while
other typechecks read them. Keep the existing `^build` prerequisites and
`dist/**` cached outputs in `turbo.json`; do not work around this race by
disabling cleaning, skipping declaration checks, or falling back to source
aliases.

The root `pnpm test:tasks` command checks these task-configuration invariants
without installed dependencies (it can also be run as
`node --test scripts/typecheck-tasks.test.ts`). The root source-typecheck
command runs it before invoking Turbo. These are configuration regressions,
not substitutes for a full typecheck with the pinned toolchain.

The schema in `examples/` is a **synthetic test fixture**, not an org schema or
sample production configuration. It deliberately supplies the custom fields,
category names, and capabilities used by the guides. Regenerate a real schema
for real Salesforce use. When adding a guide, update the fixture only to model
its explicitly documented prerequisites, not to hide an unsupported API call.

Examples are typechecked, not executed. The checker never obtains a token,
calls Salesforce, provisions an org, or runs a query. Runtime unit tests and
Salesforce integration tests remain separate responsibilities.

## Repository links

The header and page source controls link to
`https://github.com/nktnet1/kysoql`. Authored pages link to their files under
`apps/docs/content/docs/`; generated API pages link to the corresponding package
`src/index.ts` entry point. `VITE_DOCS_REPOSITORY_BRANCH` can override the source
branch used by page links; it defaults to `main`. Changing the branch requires
rebuilding the site. Never use a `VITE_` variable for access tokens, instance
secrets, or credentials.

## Search and machine-readable output

The source loader supplies all pages to the static search endpoint at
`/api/search`. The root documentation is the `framework` section, with package
pages indexed as `core`, `rest`, `auth`, `codegen`, and `jsforce`. The search dialog uses
the same section list in its Fumadocs-style filter popover, including a dedicated
Framework filter. Unfiltered search still searches every section.

The site also exposes:

- `/docs/index.md` and `/docs/<section>/<page>.md`: processed page Markdown.
- `/llms.txt`: the documentation index.
- `/llms-full.txt`: the full processed documentation.

These responses declare their text/Markdown content types. The Vite prerender
configuration includes the documentation entry point, search, and both index
routes; page links and the hidden Markdown links are crawled for static output.
Verify these endpoints when changing routing, source configuration, or hosting.

## Scope of changes

The website presents usage documentation. It must not bundle the Salesforce
client, make live org requests, display real org data, or turn development
fixtures into public credentials. Keep production library behaviour changes in
the package workspaces and cover them with their own tests.
