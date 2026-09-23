const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

const IDENTIFIER_ERROR =
  "SOQL identifiers must contain only letters, numbers, and underscores, and no identifier segment can start with a number.";
const REFERENCE_ERROR =
  "SOQL field references must be dot-separated identifiers containing only letters, numbers, and underscores, and no path segment can start with a number.";

export function parseSoqlIdentifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(IDENTIFIER_ERROR);
  }

  return value;
}

export function parseSoqlReference(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !value.split(".").every((segment) => IDENTIFIER_PATTERN.test(segment))
  ) {
    throw new TypeError(REFERENCE_ERROR);
  }

  return value;
}
