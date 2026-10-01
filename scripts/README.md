# Repository scripts

Scripts are grouped by responsibility:

- `ci/` — repository-wide validation and CI orchestration.
- `release/` — versioning, release checks, package tarballs, npm publishing, trusted-publisher setup, and release metadata.
- `salesforce/` — scratch-org setup, schema generation, and live Salesforce smoke tests.
- `verify/` — package/public API shape and packed-consumer verification.
- `lib/` — shared script utilities.

Package scripts in the root `package.json` are the supported entrypoints. Prefer those over invoking files directly unless a GitHub workflow specifically needs the lower-level release step.
