#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SALESFORCE_DIR="$REPO_ROOT/test/salesforce"
TARGET_ORG="${KYSOQL_TARGET_ORG:-kysoql-test}"

usage() {
  cat <<'USAGE'
Usage: pnpm salesforce:apex-binds [options]

Run the static-Apex bind-expression smoke fixture against an authenticated org.

Options:
  --target-org <alias>  Salesforce org alias (default: kysoql-test)
  -h, --help            Show this help

Environment equivalent:
  KYSOQL_TARGET_ORG
USAGE
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --target-org)
      (($# >= 2)) || fail "--target-org requires a value"
      TARGET_ORG="$2"
      shift 2
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

command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"

(
  cd "$SALESFORCE_DIR"
  pnpm sf apex run \
    --target-org "$TARGET_ORG" \
    --file scripts/apex/static-bind-smoke.apex
)
