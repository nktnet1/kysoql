#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js is required." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" != "26" ]]; then
  echo "error: kysoql requires Node.js 26; found $(node --version)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm is required." >&2
  exit 1
fi

run_step() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  "$@"
}

run_step "TypeScript typecheck" pnpm typecheck
run_step "Vitest" pnpm test
run_step "Build" pnpm build

printf '\nAll local validation checks passed.\n'
