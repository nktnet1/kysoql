# Kysoql documentation

The public documentation lives in `content/docs` and is built with TanStack Start and Fumadocs. The site is static and never connects to Salesforce.

## Run the docs locally

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter docs dev
```

Build or preview the static site with:

```bash
pnpm --filter docs build
pnpm --filter docs preview
```

Use the repository's pinned Node.js, pnpm, and TypeScript versions when investigating build or type errors.

## Content layout

| Root | What belongs there |
| --- | --- |
| `framework/` | Getting started and everyday query-building guides |
| `core/` | Core-specific Apex, advanced features, schema types, security, and references |
| `rest/` | Native REST execution and token-provider integration |
| `auth/` | Salesforce OAuth flows and refresh-token storage |
| `codegen/` | Schema generation, config, and field filtering |
| `jsforce/` | The optional JSforce executor |

These are peer Fumadocs roots. `/docs` opens the Framework section by default.

Every navigation folder has an explicit `meta.json`. Add new pages there rather than relying on filename order.

## Generated API reference

TypeDoc generates each public package API into its matching docs root. The generated `api/` trees are ignored by Git and recreated before docs development, builds, and content validation.

Generate all references or one package at a time:

```bash
pnpm --filter docs docs:api
pnpm --filter docs docs:api:core
pnpm --filter docs docs:api:rest
pnpm --filter docs docs:api:auth
pnpm --filter docs docs:api:codegen
pnpm --filter docs docs:api:jsforce
```

Generated pages should not be edited by hand. Change package source comments or the TypeDoc tooling instead.

## Writing style

Write for developers using Kysoql, not for developers maintaining its internals.

Prefer direct explanations such as "Use `.executeAll()` when you need QueryAll" over implementation narratives about how the adapter is structured. Keep implementation detail when it changes how a consumer should configure, secure, debug, or reason about the package.

A few house rules:

- Use short paragraphs and natural sentences.
- Avoid semicolons in prose.
- Prefer active voice and concrete verbs.
- Explain the practical consequence before edge-case mechanics.
- Use tables for compact comparisons, not long narrative cells.
- Use Fumadocs tabs for package-manager variants.
- Use accordions for secondary caveats, FAQs, and details that would interrupt the main flow.
- Keep Beta and Pilot Salesforce features visibly marked.
- Do not call Kysoql a Kysely dialect, Kysely-compatible, or a SQL abstraction.
- Keep API execution, static Apex, and dynamic Apex concepts separate.
- Never imply that generated types grant Salesforce permissions.

Start authored pages with quoted frontmatter:

```yaml
---
title: "Page title"
description: "Explain what the reader will accomplish."
---
```

The page layout renders the H1 from `title`, so body headings start at H2.

Use absolute internal links such as `/docs/framework/guides/filtering`. Code fences need a supported language. Fumadocs metadata such as `title="src/db.ts"` is supported.

Shared TypeScript examples import `db` from `./db` and generated types from `./salesforce.generated`. Local imports stay extensionless because the example checker uses `ESNext` and `Bundler` module resolution.

Use `text` for output, `sql` for SOQL, and `apex` for Apex snippets. Do not label incomplete pseudocode as executable TypeScript.

## Consumer examples

Examples should describe APIs that exist today and should be independently understandable without reading package internals.

Call out prerequisites when an example depends on custom Salesforce fields, object metadata, a Salesforce feature flag, or a particular execution context.

Generated schemas are compile-time metadata. They do not replace Salesforce authorization, org feature checks, API-version behaviour, or runtime limits.

## Validate docs changes

The normal repository gate includes docs validation:

```bash
pnpm typecheck:source
```

For docs-only work with its build prerequisites:

```bash
pnpm exec turbo run typecheck:source --filter=docs
```

Focused checks are also available:

```bash
pnpm --filter docs check:content
pnpm --filter docs check:examples
pnpm --filter docs types:check
pnpm --filter docs build
```

`check:content` validates frontmatter, routes, navigation, code fences, JSON examples, internal links, headings, and placeholders.

`check:examples` extracts authored TypeScript examples and typechecks them against the built public package declarations. It does not connect to Salesforce or execute the queries.

The schema in `examples/` is a synthetic fixture used to make documentation examples typecheck. Do not present it as a real org schema.

## Repository links and static hosting

The site links back to `https://github.com/nktnet1/kysoql`. `VITE_DOCS_REPOSITORY_BRANCH` can override the branch used by source links and defaults to `main`.

GitHub Pages hosting supplies a base path at build time. Keep app links and router configuration base-path aware so the site works both at `/` locally and under the repository path in Pages.

Never put access tokens or Salesforce credentials in `VITE_` or `PUBLIC_` variables. They are public build-time values.

## Search and machine-readable docs

The site provides static search plus Markdown-friendly endpoints for tools and language models:

- `/docs/index.md` and `/docs/<section>/<page>.md`
- `/llms.txt`
- `/llms-full.txt`

When changing routing or static hosting, verify that docs pages, search, deep links, and these machine-readable routes still work from the configured base path.
