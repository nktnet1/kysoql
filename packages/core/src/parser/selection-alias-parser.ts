import * as v from "valibot";

const ALIAS_ERROR =
  "SOQL selection aliases must start with a letter or underscore and contain only letters, numbers, and underscores.";
const RESERVED_ALIAS_ERROR = "SOQL selection aliases cannot be reserved keywords.";

const reservedAliases = new Set([
  "AND",
  "ASC",
  "DESC",
  "EXCLUDES",
  "FIRST",
  "FROM",
  "GROUP",
  "HAVING",
  "IN",
  "INCLUDES",
  "LAST",
  "LIKE",
  "LIMIT",
  "NOT",
  "NULL",
  "NULLS",
  "OR",
  "SELECT",
  "USING",
  "WHERE",
  "WITH",
]);

const selectionAliasSchema = v.pipe(
  v.string(ALIAS_ERROR),
  v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/, ALIAS_ERROR),
);

export function parseSelectionAlias(alias: string): string {
  const result = v.safeParse(selectionAliasSchema, alias);

  if (!result.success) {
    throw new TypeError(result.issues[0].message);
  }

  if (reservedAliases.has(result.output.toUpperCase())) {
    throw new TypeError(RESERVED_ALIAS_ERROR);
  }

  return result.output;
}
