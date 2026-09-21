#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SALESFORCE_DIR="$REPO_ROOT/test/salesforce"

DEV_HUB_ALIAS="${KYSOQL_DEV_HUB_ALIAS:-kysoql-dev-hub}"
SCRATCH_ALIAS="${KYSOQL_SCRATCH_ALIAS:-kysoql-test}"
DURATION_DAYS="${KYSOQL_SCRATCH_DURATION_DAYS:-30}"
RECREATE=false
SKIP_INSTALL=false
NO_LOGIN=false
CREATED_SCRATCH=false

usage() {
  cat <<'USAGE'
Usage: pnpm salesforce:setup [options]

Create, deploy, seed, and smoke-test the kysoql Salesforce scratch org.

Options:
  --dev-hub <alias>       Dev Hub alias (default: kysoql-dev-hub)
  --alias <alias>         Scratch org alias (default: kysoql-test)
  --duration-days <days>  Scratch org lifetime (default: 30)
  --recreate              Delete an existing scratch org with the target alias first
  --skip-install          Skip `pnpm install --frozen-lockfile`
  --no-login              Fail instead of opening a browser when Dev Hub auth is missing
  -h, --help              Show this help

Environment equivalents:
  KYSOQL_DEV_HUB_ALIAS
  KYSOQL_SCRATCH_ALIAS
  KYSOQL_SCRATCH_DURATION_DAYS
USAGE
}

cleanup_hint() {
  if [[ "$CREATED_SCRATCH" == true ]]; then
    printf '\nThe scratch org was created but setup did not complete. It was not deleted automatically.\n' >&2
    printf 'Inspect it with: pnpm sf org open --target-org %q\n' "$SCRATCH_ALIAS" >&2
    printf 'Delete it with:  pnpm sf org delete scratch --target-org %q --no-prompt\n' "$SCRATCH_ALIAS" >&2
  fi
}

on_error() {
  local status=$?
  trap - ERR
  cleanup_hint
  exit "$status"
}
trap on_error ERR

fail() {
  printf 'error: %s\n' "$*" >&2
  cleanup_hint
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

sf() {
  (
    cd "$SALESFORCE_DIR"
    pnpm sf "$@"
  )
}

org_exists() {
  sf org display --target-org "$1" --json >/dev/null 2>&1
}

while (($# > 0)); do
  case "$1" in
    --dev-hub)
      (($# >= 2)) || fail "--dev-hub requires a value"
      DEV_HUB_ALIAS="$2"
      shift 2
      ;;
    --alias)
      (($# >= 2)) || fail "--alias requires a value"
      SCRATCH_ALIAS="$2"
      shift 2
      ;;
    --duration-days)
      (($# >= 2)) || fail "--duration-days requires a value"
      DURATION_DAYS="$2"
      shift 2
      ;;
    --recreate)
      RECREATE=true
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --no-login)
      NO_LOGIN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

[[ "$DEV_HUB_ALIAS" != "$SCRATCH_ALIAS" ]] || fail "Dev Hub and scratch org aliases must be different"
[[ "$DURATION_DAYS" =~ ^[0-9]+$ ]] || fail "--duration-days must be an integer"
((DURATION_DAYS >= 1 && DURATION_DAYS <= 30)) || fail "--duration-days must be between 1 and 30"

require_command node
require_command pnpm

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" == "26" ]] || fail "Node 26 is required; found $(node --version)"

if [[ "$SKIP_INSTALL" == false ]]; then
  printf 'Installing workspace dependencies from the lockfile...\n'
  (
    cd "$REPO_ROOT"
    pnpm install --frozen-lockfile
  )
fi

sf --version >/dev/null

if ! org_exists "$DEV_HUB_ALIAS"; then
  if [[ "$NO_LOGIN" == true || ! -t 0 ]]; then
    fail "Dev Hub '$DEV_HUB_ALIAS' is not authenticated. Run: pnpm sf org login web --alias '$DEV_HUB_ALIAS'"
  fi

  printf "Dev Hub '%s' is not authenticated; opening Salesforce web login...\n" "$DEV_HUB_ALIAS"
  sf org login web --alias "$DEV_HUB_ALIAS"
fi

if org_exists "$SCRATCH_ALIAS"; then
  if [[ "$RECREATE" != true ]]; then
    fail "org alias '$SCRATCH_ALIAS' already exists; choose another --alias or pass --recreate"
  fi

  printf "Deleting existing scratch org '%s' because --recreate was requested...\n" "$SCRATCH_ALIAS"
  sf org delete scratch --target-org "$SCRATCH_ALIAS" --no-prompt
fi

printf "Creating scratch org '%s' from Dev Hub '%s'...\n" "$SCRATCH_ALIAS" "$DEV_HUB_ALIAS"
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias "$SCRATCH_ALIAS" \
  --target-dev-hub "$DEV_HUB_ALIAS" \
  --duration-days "$DURATION_DAYS"
CREATED_SCRATCH=true

printf 'Deploying fixture metadata...\n'
sf project deploy start \
  --target-org "$SCRATCH_ALIAS" \
  --source-dir force-app

printf 'Assigning Kysoql_Test permission set...\n'
sf org assign permset \
  --target-org "$SCRATCH_ALIAS" \
  --name Kysoql_Test

printf 'Seeding deterministic fixture data...\n'
sf apex run \
  --target-org "$SCRATCH_ALIAS" \
  --file scripts/apex/seed.apex

printf 'Running static Apex bind smoke test...\n'
sf apex run \
  --target-org "$SCRATCH_ALIAS" \
  --file scripts/apex/static-bind-smoke.apex

printf 'Running grouped aggregate OFFSET smoke test...\n'
KYSOQL_TARGET_ORG="$SCRATCH_ALIAS" "$REPO_ROOT/scripts/run-salesforce-aggregate-offset-smoke.sh"

printf 'Running generated-query Salesforce E2E suite...\n'
KYSOQL_TARGET_ORG="$SCRATCH_ALIAS" "$REPO_ROOT/scripts/run-salesforce-generated-e2e.sh"

printf 'Running fixture smoke test...\n'
SMOKE_JSON="$(sf data query \
  --target-org "$SCRATCH_ALIAS" \
  --query "SELECT Id, External_Id__c, Account__r.Name FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' ORDER BY External_Id__c" \
  --json)"

SMOKE_COUNT="$(printf '%s' "$SMOKE_JSON" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    if (response.status !== 0) process.exit(1);
    process.stdout.write(String(response.result?.totalSize ?? -1));
  });
')"

[[ "$SMOKE_COUNT" == "3" ]] || fail "expected 3 seeded Kysoql_Record__c rows; found $SMOKE_COUNT"

CREATED_SCRATCH=false
trap - ERR

cat <<SUMMARY

Salesforce test org is ready.

  Dev Hub:     $DEV_HUB_ALIAS
  Scratch org: $SCRATCH_ALIAS
  Seed rows:   $SMOKE_COUNT

Useful commands:
  pnpm sf org open --target-org $SCRATCH_ALIAS
  pnpm sf data query --target-org $SCRATCH_ALIAS --query "SELECT Id, Name, External_Id__c FROM Kysoql_Record__c ORDER BY External_Id__c"
  pnpm sf org delete scratch --target-org $SCRATCH_ALIAS --no-prompt
SUMMARY
