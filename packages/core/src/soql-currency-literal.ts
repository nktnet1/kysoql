import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlCurrencyLiteralBrand: unique symbol;

export interface SoqlCurrencyLiteral {
  readonly kind: "SoqlCurrencyLiteral";
  readonly isoCode: string;
  readonly value: number;
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
