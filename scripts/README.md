# Repository scripts

Repository automation is grouped by job:

- `ci/` runs the repository validation and CI entrypoints.
- `release/` handles package bootstrap, versioning, release checks, tarballs, publishing, and trusted publishing setup.
- `salesforce/` sets up the scratch org and runs live Salesforce smoke tests.
- `verify/` checks package exports, publish shape, and packed consumer behaviour.
- `lib/` contains utilities shared by the scripts above.

Tests for repository scripts live under `tests/scripts/` with the same broad category structure. Docs-specific tests live under `apps/docs/tests/`.

Use the root `package.json` scripts as the normal entrypoints instead of calling files in this directory directly. GitHub workflows may call lower-level release steps when they need a specific stage.

Most package and release orchestration uses pnpm. `oidc:trust` uses npm's official `npm trust` command because trusted-publisher configuration is owned by npm. The final OIDC publish step also uses the npm CLI bundled with the selected Node.js runtime.

Terminal formatting goes through `lib/output.ts`. Keep colour focused on short status labels, commands, package names, and versions so the surrounding explanation remains easy to scan.
