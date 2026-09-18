import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlRelativeDateLiteralBrand: unique symbol;

const fixedRelativeDateValues = [
  "TODAY",
  "YESTERDAY",
  "TOMORROW",
  "LAST_MONTH",
  "THIS_MONTH",
  "NEXT_MONTH",
  "LAST_QUARTER",
  "THIS_QUARTER",
  "NEXT_QUARTER",
] as const;
const relativeDateFamilies = [
  "LAST_N_DAYS",
  "NEXT_N_DAYS",
  "LAST_N_MONTHS",
  "NEXT_N_MONTHS",
] as const;

export type SoqlRelativeDateFamily = (typeof relativeDateFamilies)[number];

type SoqlFixedRelativeDateValue = (typeof fixedRelativeDateValues)[number];

type SoqlParameterizedRelativeDateValue = `${SoqlRelativeDateFamily}:${number}`;

export type SoqlRelativeDateValue =
  | SoqlFixedRelativeDateValue
  | SoqlParameterizedRelativeDateValue;

export interface SoqlRelativeDateLiteral {
  readonly kind: "SoqlRelativeDateLiteral";
  readonly value: SoqlRelativeDateValue;
  readonly [soqlRelativeDateLiteralBrand]: never;
}

const INVALID_FIXED_RELATIVE_DATE =
  "SOQL fixed relative date literals must be TODAY, YESTERDAY, TOMORROW, LAST_MONTH, THIS_MONTH, NEXT_MONTH, LAST_QUARTER, THIS_QUARTER, or NEXT_QUARTER.";
const INVALID_RELATIVE_DATE_FAMILY =
  "SOQL relative date family must be LAST_N_DAYS, NEXT_N_DAYS, LAST_N_MONTHS, or NEXT_N_MONTHS.";
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

  const match =
    /^(?:LAST_N_DAYS|NEXT_N_DAYS|LAST_N_MONTHS|NEXT_N_MONTHS):(0|[1-9]\d*)$/u.exec(
      value,
    );

  return match !== null && Number.isSafeInteger(Number(match[1]));
}
