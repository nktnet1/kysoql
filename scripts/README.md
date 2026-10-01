# Repository scripts

Scripts are grouped by responsibility:

- `ci/` — repository-wide validation and CI orchestration.
- `release/` — registry package bootstrap, stable/beta versioning, release checks,
  package tarballs, publishing, trusted-publisher setup, and release metadata.
- `salesforce/` — scratch-org setup, schema generation, and live Salesforce smoke tests.
- `verify/` — package/public API shape and packed-consumer verification.
- `lib/` — shared script utilities.

Tests for repository scripts live under `tests/scripts/` using the same category
structure. Documentation script tests live under `apps/docs/tests/`; test files
should not be mixed into `scripts/` directories.

Package scripts in the root `package.json` are the supported entrypoints. Prefer
those over invoking files directly unless a GitHub workflow specifically needs the
lower-level release step. Registry bootstrap and release planning use pnpm. `oidc:trust` intentionally calls
the official `npm trust` command because pnpm does not expose trusted-publisher
governance, and the final GitHub OIDC publication step invokes the npm CLI bundled
with the selected Node.js runtime.

Terminal output uses Node's `styleText()` through `lib/output.ts`. Style only
status words, package/version identifiers, commands, and other key tokens; keep
the surrounding explanatory text uncoloured.
