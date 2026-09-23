import * as v from "valibot";

import { freeze } from "#/util/object-utils";

declare const soqlLikeLiteralBrand: unique symbol;

export interface SoqlLikeLiteral {
  readonly kind: "SoqlLikeLiteral";
  readonly value: string;
  readonly [soqlLikeLiteralBrand]: never;
}

const LIKE_LITERAL_ERROR = "SOQL LIKE literal values must be strings.";
const likeLiteralSchema = v.object({
  kind: v.literal("SoqlLikeLiteral"),
  value: v.string(LIKE_LITERAL_ERROR),
});

/**
 * Treat every character in a LIKE value literally, including `%` and `_`.
 *
 * Plain strings passed to a LIKE predicate keep Salesforce wildcard semantics.
 */
export function soqlLikeLiteral(value: string): SoqlLikeLiteral {
  const result = v.safeParse(v.string(LIKE_LITERAL_ERROR), value);

  if (!result.success) {
    throw new TypeError(result.issues[0].message);
  }

  return freeze({
    kind: "SoqlLikeLiteral",
    value: result.output,
  }) as SoqlLikeLiteral;
}

export function isSoqlLikeLiteral(value: unknown): value is SoqlLikeLiteral {
  return v.safeParse(likeLiteralSchema, value).success;
}
