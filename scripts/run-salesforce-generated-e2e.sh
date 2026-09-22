#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: pnpm salesforce:e2e [options]

Run kysoql-generated SOQL against an authenticated Salesforce org with Vitest.

Options:
  --target-org <alias>  Salesforce org alias (default: kysoql-test)
  -h, --help            Show this help

Environment equivalent:
  KYSOQL_TARGET_ORG
USAGE
}

command -v node >/dev/null 2>&1 || fail "node is required"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" == "26" ]] || fail "Node.js 26 is required (found $(node --version))"

TARGET_ORG="${KYSOQL_TARGET_ORG:-kysoql-test}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-org)
      [[ $# -ge 2 ]] || fail "--target-org requires a value"
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

cd "$REPO_ROOT"
pnpm --filter @kysoql/core build
KYSOQL_TARGET_ORG="$TARGET_ORG" pnpm exec vitest run --config vitest.salesforce.config.ts
