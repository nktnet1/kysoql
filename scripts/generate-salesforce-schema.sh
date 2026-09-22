#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

pnpm exec turbo run build --filter=@kysoql/codegen

if [[ "${1:-}" == "--" ]]; then
  shift
fi

has_access_token=false
has_instance_url=false
[[ -n "${SF_ACCESS_TOKEN:-}" ]] && has_access_token=true
[[ -n "${SF_INSTANCE_URL:-}" ]] && has_instance_url=true

if [[ "$has_access_token" != "$has_instance_url" ]]; then
  printf '%s\n' \
    "error: SF_ACCESS_TOKEN and SF_INSTANCE_URL must either both be set or both be unset." \
    >&2
  exit 1
fi

if [[ "$has_access_token" == false ]]; then
  target_org="${KYSOQL_TARGET_ORG:-${KYSOQL_SCRATCH_ALIAS:-kysoql-test}}"
  org_json="$(pnpm sf org display --target-org "$target_org" --json)"
  token_json="$(pnpm sf org auth show-access-token --target-org "$target_org" --json)"

  SF_INSTANCE_URL="$(printf '%s' "$org_json" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const response = JSON.parse(input);
      const value = response.result?.instanceUrl;
      if (response.status !== 0 || !value) process.exit(1);
      process.stdout.write(value);
    });
  ')"

  SF_ACCESS_TOKEN="$(printf '%s' "$token_json" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const response = JSON.parse(input);
      const value = response.result?.accessToken;
      if (response.status !== 0 || !value) process.exit(1);
      process.stdout.write(value);
    });
  ')"

  export SF_INSTANCE_URL SF_ACCESS_TOKEN
fi

node packages/codegen/dist/cli.mjs generate "$@"
