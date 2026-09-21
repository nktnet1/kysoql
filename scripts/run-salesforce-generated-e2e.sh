#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "node is required"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" == "26" ]] || fail "Node.js 26 is required (found $(node --version))"

cd "$REPO_ROOT"
pnpm --filter @kysoql/core build
node "$SCRIPT_DIR/run-salesforce-generated-e2e.mjs" "$@"
