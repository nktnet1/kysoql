import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlCurrencyLiteralBrand: unique symbol;

/** Validated ISO currency literal used in Salesforce SOQL comparisons. */
export interface SoqlCurrencyLiteral {
  /** Literal discriminator used by the compiler. */
  readonly kind: "SoqlCurrencyLiteral";
  /** ISO 4217 currency code emitted before the numeric literal. */
  readonly isoCode: string;
  /** Numeric currency amount. */
  readonly value: number;
  /** Type-only brand used by Kysoql to preserve compile-time information; it has no user-facing runtime meaning. */
  readonly [soqlCurrencyLiteralBrand]: never;
}

const ISO_CODE_PATTERN = /^[A-Z]{3}$/u;
const INVALID_ISO_CODE =
  "SOQL currency ISO code must use exactly three uppercase ASCII letters.";
const INVALID_CURRENCY_VALUE =
  "SOQL currency literal value must be a finite number.";

const currencyIsoCodeSchema = v.pipe(
  v.string(INVALID_ISO_CODE),
  v.regex(ISO_CODE_PATTERN, INVALID_ISO_CODE),
);
const currencyValueSchema = v.pipe(
  v.number(INVALID_CURRENCY_VALUE),
  v.finite(INVALID_CURRENCY_VALUE),
);
const currencyLiteralSchema = v.object({
  kind: v.literal("SoqlCurrencyLiteral"),
  isoCode: currencyIsoCodeSchema,
  value: currencyValueSchema,
});

/**
 * Creates a validated SOQL currency literal from a three-letter ISO code and
 * finite value.
 */
export function soqlCurrency(
  isoCode: string,
  value: number,
): SoqlCurrencyLiteral {
  const isoCodeResult = v.safeParse(currencyIsoCodeSchema, isoCode);

  if (!isoCodeResult.success) {
    throw new TypeError(isoCodeResult.issues[0].message);
  }

  const valueResult = v.safeParse(currencyValueSchema, value);

  if (!valueResult.success) {
    throw new TypeError(valueResult.issues[0].message);
  }

  return freeze({
    kind: "SoqlCurrencyLiteral",
    isoCode: isoCodeResult.output,
    value: valueResult.output,
  }) as SoqlCurrencyLiteral;
}

export function isSoqlCurrencyLiteral(
  value: unknown,
): value is SoqlCurrencyLiteral {
  return v.safeParse(currencyLiteralSchema, value).success;
}
