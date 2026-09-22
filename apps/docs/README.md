# Kysoql documentation

The user documentation for the Salesforce Query Builder lives in
`content/docs`. This app uses the existing TanStack Start and Fumadocs stack;
MDX content drives navigation, search, Markdown exports, and the language-model
indexes. It does not connect to Salesforce or require Salesforce credentials.

## Run locally

Use the repository's declared toolchain: Node.js `26.8.2` (`.node-version`) and
pnpm `12.4.1` (`packageManager`). From the repository root:

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

| Section | Purpose |
| --- | --- |
| `index.mdx` | Product overview, packages, and learning paths. |
| `getting-started/` | Installation, a complete quickstart, configuration, and schema generation. |
| `guides/` | Query composition, fields, filters, relationships, functions, aggregates, and execution. |
| `apex/` | Compile-only Apex contexts and bind expressions. |
| `advanced/` | Salesforce-specific clauses, Knowledge, feeds, Data 360, and experimental features. |
| `reference/` | API surfaces, schema types, executor contracts, limitations, security, and troubleshooting. |

Each directory has a `meta.json` with an explicit `pages` array. Add new pages
there rather than relying on alphabetical ordering. Folder entries in the root
metadata point to their own navigation files.

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
text, and absolute internal links such as `/docs/guides/filtering`. Use stable
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

Document the source as it exists, not planned methods. Check changes against
`packages/core/src/index.ts`, the builders/compiler, codegen, and adapter tests.
Keep API execution, static Apex, and dynamic Apex capabilities separate. Never
imply that `executeAll()` means ordinary pagination, that generated types enforce
permissions, or that the adapter validates every selected field value.

The assumed package scope is `@kysoql`, matching the manifests. Keep installation
instructions honest about the repository's `0.0.0` versions and unpublished
workspace use. Never claim registry availability or a minimum TypeScript
version that the repository does not declare. Mark beta/pilot features and link
to the relevant official Salesforce documentation instead of promising universal
org support.

## Validate changes

Run these checks from the repository root. For standalone example checks, build
the libraries first so the docs exercise their public declaration files:

```bash
pnpm exec turbo run build --filter=@kysoql/core --filter=@kysoql/jsforce --filter=@kysoql/codegen
pnpm --filter docs check:content
pnpm --filter docs check:examples
pnpm --filter docs types:check
pnpm --filter docs build
```

`pnpm --filter docs typecheck:source` combines content checks, example
typechecks, and site typechecks. It also participates in the workspace's source-typecheck task. The workspace lint command
for this app remains `pnpm --filter docs check`.

### Content validation

`check:content` first runs the shared parser's `node:test` regression suite, then
the content checker. Both use only Node.js built-ins. They check frontmatter,
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
`.cache/docs-examples/` directory. It copies `examples/db.ts` and
`examples/salesforce.generated.ts`, then runs the installed `tsc` with strict
null checking, exact optional properties, and unchecked-index protection.

It resolves `@kysoql/*` through their built public package exports and resolves
JSforce through its adapter workspace. Each source package has its own `#/*`
path mapping, so those sources must not be flattened into one docs compiler
project. No custom development export condition is used for consumer examples.

The docs declare workspace development dependencies on all three packages, so
the root Turbo source-typecheck task builds them before checking examples. For a
standalone check, use the build command above. Missing declarations produce an
actionable error rather than falling back to incomplete source resolution.
A complete workspace dependency installation is also required. The generated
`manifest.json` maps each example filename to its MDX page and first code line.
Diagnostic line 1 is that first code line; add the diagnostic line minus one to
find its location in the original page.

The schema in `examples/` is a **synthetic test fixture**, not an org schema or
sample production configuration. It deliberately supplies the custom fields,
category names, and capabilities used by the guides. Regenerate a real schema
for real Salesforce use. When adding a guide, update the fixture only to model
its explicitly documented prerequisites, not to hide an unsupported API call.

Examples are typechecked, not executed. The checker never obtains a token,
calls Salesforce, provisions an org, or runs a query. Runtime unit tests and
Salesforce integration tests remain separate responsibilities.

## Optional repository links

The header and page source controls only show repository links when configured.
No repository owner or URL is invented. Copy `.env.example` to `.env.local` and
set these **public build-time** values for the actual hosting repository:

- `VITE_DOCS_REPOSITORY_URL`: an HTTPS GitHub repository URL with exactly an owner
  and repository path, without a branch, query string, or fragment.
- `VITE_DOCS_REPOSITORY_BRANCH`: the source branch; defaults to `main`.

Source links include the monorepo path `apps/docs/content/docs/`. Leave the URL
unset to hide those links. Changing these values requires rebuilding the site.
Never use a `VITE_` variable for access tokens, instance secrets, or credentials.

## Search and machine-readable output

The existing source loader supplies all pages to the static search endpoint at
`/api/search`. The site also exposes:

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
