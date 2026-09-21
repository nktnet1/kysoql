#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
SALESFORCE_DIR="$REPO_ROOT/test/salesforce"
TARGET_ORG="${KYSOQL_TARGET_ORG:-kysoql-test}"

usage() {
  cat <<'USAGE'
Usage: pnpm salesforce:aggregate-offset [options]

Run the grouped aggregate OFFSET smoke query against an authenticated org.

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

command -v node >/dev/null 2>&1 || fail "node is required"
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"

QUERY="SELECT Category__c, COUNT(Id) recordCount FROM Kysoql_Record__c WHERE External_Id__c LIKE 'KYSOQL-%' GROUP BY Category__c ORDER BY Category__c LIMIT 2 OFFSET 1"

QUERY_JSON="$(
  cd "$SALESFORCE_DIR"
  pnpm sf data query \
    --target-org "$TARGET_ORG" \
    --query "$QUERY" \
    --json
)"

printf '%s' "$QUERY_JSON" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const response = JSON.parse(input);
    if (response.status !== 0) {
      process.stderr.write("Salesforce grouped aggregate OFFSET query failed.\n");
      process.exit(1);
    }

    const records = response.result?.records ?? [];
    const actual = records.map((record) => ({
      category: record.Category__c,
      count: record.recordCount,
    }));
    const expected = [
      { category: "Beta", count: 1 },
      { category: "Gamma", count: 1 },
    ];

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      process.stderr.write(
        `Unexpected grouped aggregate OFFSET result: ${JSON.stringify(actual)}\n`,
      );
      process.exit(1);
    }
  });
'

printf 'Grouped aggregate OFFSET smoke test passed for %s.\n' "$TARGET_ORG"
