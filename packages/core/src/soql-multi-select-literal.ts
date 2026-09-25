import { freeze } from "#/util/object-utils";

/**
 * Represents Salesforce's semicolon-delimited multi-select picklist operand,
 * where every listed value must be selected on the matching record.
 */
export interface SoqlMultiSelectAnd<Value extends string = string> {
  /** Literal discriminator for an `INCLUDES`/`EXCLUDES` multi-select AND value. */
  readonly kind: "SoqlMultiSelectAnd";
  /** Multi-select picklist values that must all be matched together. */
  readonly values: readonly [Value, Value, ...Value[]];
}

/**
 * Creates a multi-select picklist operand that requires every listed value
 * to match.
 */
export const soqlMultiSelectAnd = <Value extends string>(
  first: Value,
  second: Value,
  ...rest: Value[]
): SoqlMultiSelectAnd<Value> =>
  freeze({
    kind: "SoqlMultiSelectAnd",
    values: freeze([first, second, ...rest]),
  });

export const isSoqlMultiSelectAnd = (
  value: unknown,
): value is SoqlMultiSelectAnd<string> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SoqlMultiSelectAnd<string>>;
  return (
    candidate.kind === "SoqlMultiSelectAnd" &&
    Array.isArray(candidate.values) &&
    candidate.values.length >= 2 &&
    candidate.values.every((item) => typeof item === "string")
  );
};
