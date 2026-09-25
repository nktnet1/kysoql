import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlRelativeDateLiteralBrand: unique symbol;

const fixedRelativeDateValues = [
  "TODAY",
  "YESTERDAY",
  "TOMORROW",
  "LAST_WEEK",
  "THIS_WEEK",
  "NEXT_WEEK",
  "LAST_MONTH",
  "THIS_MONTH",
  "NEXT_MONTH",
  "LAST_90_DAYS",
  "NEXT_90_DAYS",
  "LAST_QUARTER",
  "THIS_QUARTER",
  "NEXT_QUARTER",
  "LAST_YEAR",
  "THIS_YEAR",
  "NEXT_YEAR",
  "LAST_FISCAL_YEAR",
  "THIS_FISCAL_YEAR",
  "NEXT_FISCAL_YEAR",
  "LAST_FISCAL_QUARTER",
  "THIS_FISCAL_QUARTER",
  "NEXT_FISCAL_QUARTER",
] as const;
const relativeDateFamilies = [
  "LAST_N_DAYS",
  "NEXT_N_DAYS",
  "N_DAYS_AGO",
  "LAST_N_WEEKS",
  "NEXT_N_WEEKS",
  "N_WEEKS_AGO",
  "LAST_N_MONTHS",
  "NEXT_N_MONTHS",
  "N_MONTHS_AGO",
  "LAST_N_QUARTERS",
  "NEXT_N_QUARTERS",
  "N_QUARTERS_AGO",
  "LAST_N_YEARS",
  "NEXT_N_YEARS",
  "N_YEARS_AGO",
  "LAST_N_FISCAL_QUARTERS",
  "NEXT_N_FISCAL_QUARTERS",
  "N_FISCAL_QUARTERS_AGO",
  "LAST_N_FISCAL_YEARS",
  "NEXT_N_FISCAL_YEARS",
  "N_FISCAL_YEARS_AGO",
] as const;

/**
 * Parameterized Salesforce relative-date literal families such as
 * LAST_N_DAYS.
 */
export type SoqlRelativeDateFamily = (typeof relativeDateFamilies)[number];

type SoqlFixedRelativeDateValue = (typeof fixedRelativeDateValues)[number];

type SoqlParameterizedRelativeDateValue = `${SoqlRelativeDateFamily}:${number}`;

/**
 * Validated fixed or parameterized Salesforce relative-date literal value.
 */
export type SoqlRelativeDateValue =
  | SoqlFixedRelativeDateValue
  | SoqlParameterizedRelativeDateValue;

/**
 * Branded Salesforce relative-date literal accepted by date and datetime
 * filters.
 */
export interface SoqlRelativeDateLiteral {
  /** Literal discriminator used by the compiler. */
  readonly kind: "SoqlRelativeDateLiteral";
  /** Validated Salesforce relative-date literal, such as `LAST_N_DAYS:30`. */
  readonly value: SoqlRelativeDateValue;
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [soqlRelativeDateLiteralBrand]: never;
}

const INVALID_FIXED_RELATIVE_DATE = `SOQL fixed relative date literal must be one of: ${fixedRelativeDateValues.join(", ")}.`;
const INVALID_RELATIVE_DATE_FAMILY = `SOQL relative date family must be one of: ${relativeDateFamilies.join(", ")}.`;
const INVALID_RELATIVE_DATE_COUNT =
  "SOQL relative date count must be a non-negative safe integer.";
const INVALID_RELATIVE_DATE = "Invalid SOQL relative date literal.";

const fixedRelativeDateValueSchema = v.picklist(
  fixedRelativeDateValues,
  INVALID_FIXED_RELATIVE_DATE,
);
const relativeDateFamilySchema = v.picklist(
  relativeDateFamilies,
  INVALID_RELATIVE_DATE_FAMILY,
);
const relativeDateCountSchema = v.pipe(
  v.number(INVALID_RELATIVE_DATE_COUNT),
  v.safeInteger(INVALID_RELATIVE_DATE_COUNT),
  v.minValue(0, INVALID_RELATIVE_DATE_COUNT),
);
const relativeDateValueSchema = v.pipe(
  v.string(INVALID_RELATIVE_DATE),
  v.check(isValidRelativeDateValue, INVALID_RELATIVE_DATE),
);

const relativeDateLiteralSchema = v.object({
  kind: v.literal("SoqlRelativeDateLiteral"),
  value: relativeDateValueSchema,
});

/**
 * Creates a validated fixed or parameterized Salesforce relative-date
 * literal.
 */
export function soqlRelativeDate(
  value: SoqlFixedRelativeDateValue,
): SoqlRelativeDateLiteral;
export function soqlRelativeDate(
  family: SoqlRelativeDateFamily,
  count: number,
): SoqlRelativeDateLiteral;
export function soqlRelativeDate(
  value: SoqlFixedRelativeDateValue | SoqlRelativeDateFamily,
  count?: number,
): SoqlRelativeDateLiteral {
  let literalValue: SoqlRelativeDateValue;

  if (count === undefined) {
    const result = v.safeParse(fixedRelativeDateValueSchema, value);

    if (!result.success) {
      throw new TypeError(result.issues[0].message);
    }

    literalValue = result.output;
  } else {
    const familyResult = v.safeParse(relativeDateFamilySchema, value);

    if (!familyResult.success) {
      throw new TypeError(familyResult.issues[0].message);
    }

    const countResult = v.safeParse(relativeDateCountSchema, count);

    if (!countResult.success) {
      throw new RangeError(countResult.issues[0].message);
    }

    literalValue = `${familyResult.output}:${countResult.output}`;
  }

  return freeze({
    kind: "SoqlRelativeDateLiteral",
    value: literalValue,
  }) as SoqlRelativeDateLiteral;
}

export function isSoqlRelativeDateLiteral(
  value: unknown,
): value is SoqlRelativeDateLiteral {
  return v.safeParse(relativeDateLiteralSchema, value).success;
}

function isValidRelativeDateValue(value: string): boolean {
  if ((fixedRelativeDateValues as readonly string[]).includes(value)) {
    return true;
  }

  const separatorIndex = value.indexOf(":");

  if (
    separatorIndex <= 0 ||
    separatorIndex === value.length - 1 ||
    value.indexOf(":", separatorIndex + 1) !== -1
  ) {
    return false;
  }

  const family = value.slice(0, separatorIndex);
  const count = value.slice(separatorIndex + 1);

  return (
    (relativeDateFamilies as readonly string[]).includes(family) &&
    /^(?:0|[1-9]\d*)$/u.test(count) &&
    Number.isSafeInteger(Number(count))
  );
}
