import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlDateLiteralBrand: unique symbol;
declare const soqlDateTimeLiteralBrand: unique symbol;
declare const soqlTimeLiteralBrand: unique symbol;

export interface SoqlDateLiteral {
  readonly kind: "SoqlDateLiteral";
  readonly value: string;
  readonly [soqlDateLiteralBrand]: never;
}

export interface SoqlDateTimeLiteral {
  readonly kind: "SoqlDateTimeLiteral";
  readonly value: string;
  readonly [soqlDateTimeLiteralBrand]: never;
}

export interface SoqlTimeLiteral {
  readonly kind: "SoqlTimeLiteral";
  readonly value: string;
  readonly [soqlTimeLiteralBrand]: never;
}

export type SoqlTemporalLiteral =
  | SoqlDateLiteral
  | SoqlDateTimeLiteral
  | SoqlTimeLiteral;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const TIME_PATTERN = /^\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

const INVALID_DATE = "SOQL date literals contain an invalid date.";
const INVALID_DATE_TIME_DATE =
  "SOQL dateTime literals contain an invalid date.";
const INVALID_DATE_TIME_TIME =
  "SOQL dateTime literals contain an invalid time.";
const INVALID_DATE_TIME_OFFSET =
  "SOQL dateTime literals contain an invalid UTC offset.";
const INVALID_DATE_TIME_FORMAT =
  "SOQL dateTime literals must use YYYY-MM-DDThh:mm:ss[.SSS]Z or YYYY-MM-DDThh:mm:ss[.SSS]+/-hh:mm.";
const INVALID_TIME = "SOQL time literals contain an invalid time.";
const INVALID_TIME_FORMAT =
  "SOQL time literals must use hh:mm:ssZ or hh:mm:ss.SSSZ.";

const dateSchema = v.pipe(
  v.string(INVALID_DATE),
  v.regex(DATE_PATTERN, INVALID_DATE),
  v.check(isValidDate, INVALID_DATE),
);

const dateTimeSchema = v.pipe(
  v.string(INVALID_DATE_TIME_FORMAT),
  v.regex(DATE_TIME_PATTERN, INVALID_DATE_TIME_FORMAT),
  v.check((value) => isValidDate(value.slice(0, 10)), INVALID_DATE_TIME_DATE),
  v.check(
    (value) => isValidClockTime(value.slice(11, 19)),
    INVALID_DATE_TIME_TIME,
  ),
  v.check(hasValidUtcOffset, INVALID_DATE_TIME_OFFSET),
);

const timeSchema = v.pipe(
  v.string(INVALID_TIME_FORMAT),
  v.regex(TIME_PATTERN, INVALID_TIME_FORMAT),
  v.check((value) => isValidClockTime(value.slice(0, 8)), INVALID_TIME),
);

const temporalLiteralSchema = v.variant("kind", [
  v.object({
    kind: v.literal("SoqlDateLiteral"),
    value: dateSchema,
  }),
  v.object({
    kind: v.literal("SoqlDateTimeLiteral"),
    value: dateTimeSchema,
  }),
  v.object({
    kind: v.literal("SoqlTimeLiteral"),
    value: timeSchema,
  }),
]);

export function soqlDate(value: string): SoqlDateLiteral {
  return freeze({
    kind: "SoqlDateLiteral",
    value: parseTemporalValue(dateSchema, value),
  }) as SoqlDateLiteral;
}

export function soqlDateTime(value: string): SoqlDateTimeLiteral {
  return freeze({
    kind: "SoqlDateTimeLiteral",
    value: parseTemporalValue(dateTimeSchema, value),
  }) as SoqlDateTimeLiteral;
}

export function soqlTime(value: string): SoqlTimeLiteral {
  return freeze({
    kind: "SoqlTimeLiteral",
    value: parseTemporalValue(timeSchema, value),
  }) as SoqlTimeLiteral;
}

export function isSoqlTemporalLiteral(
  value: unknown,
): value is SoqlTemporalLiteral {
  return v.safeParse(temporalLiteralSchema, value).success;
}

function parseTemporalValue(
  schema: v.GenericSchema<string>,
  value: string,
): string {
  const result = v.safeParse(schema, value);

  if (!result.success) {
    throw new TypeError(result.issues[0].message);
  }

  return result.output;
}

function isValidDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (year < 1700 || year > 4000 || month < 1 || month > 12) {
    return false;
  }

  return day >= 1 && day <= daysInMonth(year, month);
}

function isValidClockTime(value: string): boolean {
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  const seconds = Number(value.slice(6, 8));

  return hours <= 23 && minutes <= 59 && seconds <= 59;
}

function hasValidUtcOffset(value: string): boolean {
  if (value.endsWith("Z")) {
    return true;
  }

  const timeZone = value.slice(-6);
  const offsetHours = Number(timeZone.slice(1, 3));
  const offsetMinutes = Number(timeZone.slice(4, 6));

  return (
    offsetHours <= 14 &&
    offsetMinutes <= 59 &&
    (offsetHours !== 14 || offsetMinutes === 0)
  );
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
