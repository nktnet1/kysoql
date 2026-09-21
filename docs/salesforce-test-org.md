# Salesforce test org

The repository includes a small Salesforce DX project under `test/salesforce` for
manual and integration testing. It creates a custom object with representative
field types and a lookup relationship, then seeds deterministic Accounts,
Contacts, and custom records.

The repository intentionally invokes Salesforce CLI as `pnpm sf`. The CLI is a
workspace dev dependency, so this uses the pinned project version instead of a
globally installed `sf` binary.

## Prerequisites

- Node.js 26.
- pnpm.
- A Salesforce Dev Hub that can create scratch orgs.

If you do not already have a Dev Hub, create or use a Salesforce Developer
Edition org and enable **Dev Hub** in Setup.

Authenticate it once using the local CLI:

```bash
pnpm sf org login web --alias kysoql-dev-hub
```

The setup script passes the Dev Hub alias explicitly, so it does not need to
change your global or project default Dev Hub.

## Automated setup

From the repository root, run:

```bash
pnpm salesforce:setup
```

The script safely performs the complete fixture setup:

1. verifies Node 26 and pnpm;
2. runs `pnpm install --frozen-lockfile`;
3. verifies or interactively authenticates the Dev Hub;
4. refuses to overwrite an existing `kysoql-test` alias by default;
5. creates a scratch org without changing your default target org;
6. deploys fixture metadata;
7. assigns the `Kysoql_Test` permission set;
8. runs the idempotent Apex seed script;
9. executes a static-Apex bind-expression smoke fixture covering member paths,
   collection binds, bind-left `INCLUDES`, relationship-subquery binds, structured
   addition / substring expressions, query-result field access, and bound
   pagination;
10. executes a grouped aggregate `LIMIT 2 OFFSET 1` query against the seeded
    categories and verifies that the paged results are `Beta` and `Gamma`; and
11. checks that all three custom fixture records are queryable, including their
    parent Account relationship.

Useful options:

```bash
pnpm salesforce:setup -- --help
pnpm salesforce:setup -- --alias kysoql-test-2
pnpm salesforce:setup -- --dev-hub my-dev-hub
pnpm salesforce:setup -- --duration-days 7
pnpm salesforce:setup -- --recreate
pnpm salesforce:setup -- --skip-install
pnpm salesforce:setup -- --no-login
```

`--recreate` is deliberately opt-in. If the target alias already exists, the
script otherwise stops without deleting anything. When recreation is requested,
`sf org delete scratch` is used, so Salesforce CLI itself rejects deletion if
the alias does not refer to a scratch org.

If setup fails after creating a scratch org, the script leaves that org intact
for inspection and prints an explicit cleanup command rather than deleting it
automatically.

The defaults can also be changed with `KYSOQL_DEV_HUB_ALIAS`,
`KYSOQL_SCRATCH_ALIAS`, and `KYSOQL_SCRATCH_DURATION_DAYS`.

## Manual setup

The automated setup is preferred, but each step can also be run manually.

### Create the scratch org

Run the Salesforce commands from the fixture DX project:

```bash
cd test/salesforce

pnpm sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias kysoql-test \
  --target-dev-hub kysoql-dev-hub \
  --duration-days 30
```

Salesforce CLI defaults scratch orgs to seven days; this fixture explicitly asks
for 30 days. The target Dev Hub is explicit, and no default target org is changed.
Salesforce requires a Dev Hub either through `--target-dev-hub` or a configured
default Dev Hub. See the Salesforce CLI command reference for the current
`org create scratch` flags.

### Deploy the fixture schema

```bash
pnpm sf project deploy start \
  --target-org kysoql-test \
  --source-dir force-app

pnpm sf org assign permset \
  --target-org kysoql-test \
  --name Kysoql_Test
```

The deployed fixture includes `Kysoql_Record__c` with these custom fields:

- `External_Id__c`: required unique external ID text field.
- `Amount__c`: number.
- `Active__c`: checkbox.
- `Category__c`: restricted picklist (`Alpha`, `Beta`, `Gamma`).
- `Occurred_On__c`: date.
- `Account__c`: lookup to `Account`, exposing `Account__r` and the child
  relationship `Kysoql_Records__r`.

This mix is intentional: schema generation can exercise nullability, scalar
field mappings, picklist values, external IDs, references, and relationship
metadata.

`External_Id__c` is required, so it is intentionally omitted from the permission
set's `fieldPermissions`. Salesforce rejects field-level permission metadata for
required fields.

### Seed deterministic data

The seed script is idempotent for its own fixture records. Running it again
removes only records owned by the kysoql fixture and recreates them.

```bash
pnpm sf apex run \
  --target-org kysoql-test \
  --file scripts/apex/seed.apex
```

It creates two Accounts, three Contacts, and three `Kysoql_Record__c` records.

### Verify static Apex bind expressions

The setup command automatically runs `scripts/apex/static-bind-smoke.apex` after
seeding. Re-run only that fixture against an existing authenticated org with:

```bash
pnpm salesforce:apex-binds
```

Override the target org without changing Salesforce CLI defaults:

```bash
pnpm salesforce:apex-binds -- --target-org my-scratch-org
# or
KYSOQL_TARGET_ORG=my-scratch-org pnpm salesforce:apex-binds
```

This fixture is deliberately separate from `pnpm validate`: it exercises static
Apex grammar on a real Salesforce runtime and therefore requires org credentials.
It covers the bind-expression families represented by Kysoql's Apex AST rather than
using dynamic SOQL strings.

The managed dynamic-Apex `SET OPTIONS :queryOptions` path is not part of this
generic scratch-org fixture. Salesforce scopes `Database.QueryOptions`
`explicitNamespace` to managed Apex, so meaningful runtime verification requires a
managed-package namespace rather than an ordinary unmanaged scratch org.

### Verify grouped aggregate OFFSET

The setup command automatically verifies grouped aggregate pagination after
seeding. Re-run only that fixture against an existing authenticated org with:

```bash
pnpm salesforce:aggregate-offset
```

Override the target org without changing Salesforce CLI defaults:

```bash
pnpm salesforce:aggregate-offset -- --target-org my-scratch-org
# or
KYSOQL_TARGET_ORG=my-scratch-org pnpm salesforce:aggregate-offset
```

The smoke query orders the three deterministic categories, applies `LIMIT 2
OFFSET 1`, and asserts that Salesforce returns `Beta` and `Gamma`. This keeps the
normal API aggregate builder's `OFFSET` support tied to a real-org regression
rather than compiler output alone.

## Smoke-test SOQL

A basic custom-object query:

```bash
pnpm sf data query \
  --target-org kysoql-test \
  --query "SELECT Id, Name, External_Id__c, Amount__c, Active__c, Category__c, Occurred_On__c FROM Kysoql_Record__c ORDER BY External_Id__c"
```

A child-to-parent relationship query:

```bash
pnpm sf data query \
  --target-org kysoql-test \
  --query "SELECT Id, Name, Account__r.Id, Account__r.Name FROM Kysoql_Record__c ORDER BY External_Id__c"
```

A parent-to-child relationship query:

```bash
pnpm sf data query \
  --target-org kysoql-test \
  --query "SELECT Id, Name, (SELECT Id, Name, Amount__c FROM Kysoql_Records__r ORDER BY External_Id__c) FROM Account WHERE Name LIKE 'Kysoql Test %' ORDER BY Name"
```

An aggregate query:

```bash
pnpm sf data query \
  --target-org kysoql-test \
  --query "SELECT Category__c, COUNT(Id) records, SUM(Amount__c) total FROM Kysoql_Record__c GROUP BY Category__c ORDER BY Category__c LIMIT 2 OFFSET 1"
```

These queries are useful acceptance cases for the kysoql compiler as its SOQL
surface grows. Salesforce's `data query` command executes SOQL directly and
supports JSON output, which the automated setup uses for its fixture assertion.

## Use the org with JSforce

Salesforce CLI already holds OAuth credentials for the scratch org. To inspect
non-secret connection details, run:

```bash
pnpm sf org display --target-org kysoql-test
```

Current Salesforce CLI releases redact access tokens from `sf org display`.
If you explicitly need the current token, use the dedicated credential command:

```bash
pnpm sf org auth show-access-token --target-org kysoql-test --json
```

Treat that JSON output as a credential: do not paste it into issues or CI logs,
and never commit it. The schema-generation wrapper captures this output without
printing the token.

For a local JSforce script, use ephemeral environment variables rather than
writing credentials into the repo:

```bash
export SF_INSTANCE_URL="https://your-domain.my.salesforce.com"
export SF_ACCESS_TOKEN="..."
```

Never commit access tokens or org-display output. The repository's `.gitignore`
ignores `.env` files, but shell environment variables are preferred for
short-lived scratch-org credentials.

## Generate a TypeScript schema

`@kysoql/codegen` now generates a type-level schema from Salesforce Describe
metadata. The generator uses JSforce for the API calls. In this repository,
`salesforce:schema` reuses the authenticated Salesforce CLI scratch-org session
and extracts its connection details without printing the access token.

Generate just the two objects used by the current fixture:

```bash
pnpm salesforce:schema -- \
  --object Account \
  --object Kysoql_Record__c \
  --output test/salesforce/salesforce.generated.ts
```

Omit the `--object` flags to generate every queryable object visible to the
connected user. Object and field order is deterministic so generated changes
remain reviewable in git. The generated schema records Salesforce field types,
nullability, filter/sort/group/aggregate capabilities, custom and polymorphic-reference
metadata, active picklist values, parent references, child relationships,
supported scopes, MRU capability, and data-category metadata when available.

By default the command uses the `kysoql-test` org alias. Override it without
changing your Salesforce CLI defaults:

```bash
KYSOQL_TARGET_ORG=my-scratch-org pnpm salesforce:schema -- \
  --object Account
```

`SF_INSTANCE_URL` and `SF_ACCESS_TOKEN` are still supported when both are
already present in the environment; in that case the wrapper does not invoke
the Salesforce CLI. Otherwise it reads the instance URL from `pnpm sf org
display --json` and retrieves the token with `pnpm sf org auth
show-access-token --json`. Set either both variables or neither so credentials
from different orgs cannot be mixed. Access tokens are credentials: never
commit them or print them in logs.

## Reset or delete the org

Re-run `scripts/apex/seed.apex` whenever you want to reset only the fixture data.
To discard the entire scratch org:

```bash
pnpm sf org delete scratch --target-org kysoql-test --no-prompt
```

Then run `pnpm salesforce:setup` again.
