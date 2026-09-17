# Salesforce test org

The repository includes a small Salesforce DX project under `test/salesforce` for
manual and integration testing. It creates a custom object with representative
field types and a lookup relationship, then seeds deterministic Accounts,
Contacts, and custom records.

## Prerequisites

- Node.js 26.
- Salesforce CLI (`sf`).
- A Salesforce Dev Hub that can create scratch orgs.

If you do not already have a Dev Hub, create or use a Salesforce Developer
Edition org and enable **Dev Hub** in Setup.

Authenticate the Dev Hub once:

```bash
sf org login web --set-default-dev-hub --alias kysoql-dev-hub
```

## Create the scratch org

Run the Salesforce commands from the fixture DX project:

```bash
cd test/salesforce

pnpm sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias kysoql-test \
  --set-default \
  --duration-days 30
```

The scratch org definition uses Developer edition. Scratch orgs are disposable;
the default lifetime is seven days and this command pins that explicitly.

## Deploy the fixture schema

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

## Seed deterministic data

The seed script is idempotent for its own fixture records. Running it again
removes only records owned by the kysoql fixture and recreates them.

```bash
pnpm sf apex run \
  --target-org kysoql-test \
  --file scripts/apex/seed.apex
```

It creates two Accounts, three Contacts, and three `Kysoql_Record__c` records.

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
  --query "SELECT Category__c, COUNT(Id) records, SUM(Amount__c) total FROM Kysoql_Record__c GROUP BY Category__c ORDER BY Category__c"
```

These queries are useful acceptance cases for the kysoql compiler as its SOQL
surface grows.

## Use the org with JSforce

Salesforce CLI already holds OAuth credentials for the scratch org. To inspect
the authenticated connection details, run:

```bash
pnpm sf org display --target-org kysoql-test --verbose --json
```

For a local JSforce script, use the returned instance URL and access token as
ephemeral environment variables rather than writing credentials into the repo:

```bash
export SF_INSTANCE_URL="https://your-domain.my.salesforce.com"
export SF_ACCESS_TOKEN="..."
```

Never commit access tokens or the verbose org-display output. The repository's
`.gitignore` ignores `.env` files, but shell environment variables are preferred
for short-lived scratch-org credentials.

## Reset or delete the org

Re-run `scripts/apex/seed.apex` whenever you want to reset only the fixture data.
To discard the entire scratch org:

```bash
pnpm sf org delete scratch --target-org kysoql-test --no-prompt
```

Then repeat the create, deploy, permission-set, and seed steps above.
