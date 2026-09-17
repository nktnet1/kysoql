import { freeze } from "./util/object-utils.js";

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

export function soqlDate(value: string): SoqlDateLiteral {
  assertDate(value, "date");

  return freeze({
    kind: "SoqlDateLiteral",
    value,
  }) as SoqlDateLiteral;
}

export function soqlDateTime(value: string): SoqlDateTimeLiteral {
  assertDateTime(value);

  return freeze({
    kind: "SoqlDateTimeLiteral",
    value,
  }) as SoqlDateTimeLiteral;
}

export function soqlTime(value: string): SoqlTimeLiteral {
  assertTime(value);

  return freeze({
    kind: "SoqlTimeLiteral",
    value,
  }) as SoqlTimeLiteral;
}

export function isSoqlTemporalLiteral(
  value: unknown,
): value is SoqlTemporalLiteral {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    readonly kind?: unknown;
    readonly value?: unknown;
  };

  if (typeof candidate.value !== "string") {
    return false;
  }

  try {
    switch (candidate.kind) {
      case "SoqlDateLiteral":
        assertDate(candidate.value, "date");
        return true;
      case "SoqlDateTimeLiteral":
        assertDateTime(candidate.value);
        return true;
      case "SoqlTimeLiteral":
        assertTime(candidate.value);
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function assertDateTime(value: string): void {
  if (!DATE_TIME_PATTERN.test(value)) {
    throw new TypeError(
      "SOQL dateTime literals must use YYYY-MM-DDThh:mm:ss[.SSS]Z or YYYY-MM-DDThh:mm:ss[.SSS]+/-hh:mm.",
    );
  }

  assertDate(value.slice(0, 10), "dateTime");
  assertClockTime(value.slice(11, 19), "dateTime");

  const timeZone = value[value.length - 1] === "Z" ? "Z" : value.slice(-6);

  if (timeZone !== "Z") {
    const offsetHours = Number(timeZone.slice(1, 3));
    const offsetMinutes = Number(timeZone.slice(4, 6));

    if (
      offsetHours > 14 ||
      offsetMinutes > 59 ||
      (offsetHours === 14 && offsetMinutes !== 0)
    ) {
      throw new TypeError("SOQL dateTime literals contain an invalid UTC offset.");
    }
  }
}

function assertTime(value: string): void {
  if (!TIME_PATTERN.test(value)) {
    throw new TypeError(
      "SOQL time literals must use hh:mm:ssZ or hh:mm:ss.SSSZ.",
    );
  }

  assertClockTime(value.slice(0, 8), "time");
}

function assertDate(value: string, literalType: "date" | "dateTime"): void {
  if (!DATE_PATTERN.test(value)) {
    throw new TypeError(`SOQL ${literalType} literals contain an invalid date.`);
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (year < 1700 || year > 4000 || month < 1 || month > 12) {
    throw new TypeError(`SOQL ${literalType} literals contain an invalid date.`);
  }

  const maxDay = daysInMonth(year, month);

  if (day < 1 || day > maxDay) {
    throw new TypeError(`SOQL ${literalType} literals contain an invalid date.`);
  }
}

function assertClockTime(
  value: string,
  literalType: "dateTime" | "time",
): void {
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  const seconds = Number(value.slice(6, 8));

  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new TypeError(`SOQL ${literalType} literals contain an invalid time.`);
  }
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
