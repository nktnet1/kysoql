import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlRelativeDateLiteralBrand: unique symbol;

const soqlRelativeDateValues = ["TODAY", "YESTERDAY", "TOMORROW"] as const;

export type SoqlRelativeDateValue = (typeof soqlRelativeDateValues)[number];

export interface SoqlRelativeDateLiteral {
  readonly kind: "SoqlRelativeDateLiteral";
  readonly value: SoqlRelativeDateValue;
  readonly [soqlRelativeDateLiteralBrand]: never;
}

const INVALID_RELATIVE_DATE =
  "SOQL relative date literals must be TODAY, YESTERDAY, or TOMORROW.";

const relativeDateValueSchema = v.picklist(
  soqlRelativeDateValues,
  INVALID_RELATIVE_DATE,
);

const relativeDateLiteralSchema = v.object({
  kind: v.literal("SoqlRelativeDateLiteral"),
  value: relativeDateValueSchema,
});

export function soqlRelativeDate(
  value: SoqlRelativeDateValue,
): SoqlRelativeDateLiteral {
  const result = v.safeParse(relativeDateValueSchema, value);

  if (!result.success) {
    throw new TypeError(result.issues[0].message);
  }

  return freeze({
    kind: "SoqlRelativeDateLiteral",
    value: result.output,
  }) as SoqlRelativeDateLiteral;
}

export function isSoqlRelativeDateLiteral(
  value: unknown,
): value is SoqlRelativeDateLiteral {
  return v.safeParse(relativeDateLiteralSchema, value).success;
}
