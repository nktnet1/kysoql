import * as v from "valibot";

import { LimitNode } from "../operation-node/limit-node.js";

const LIMIT_ERROR = "SOQL LIMIT must be a non-negative safe integer.";
const limitSchema = v.pipe(
  v.number(LIMIT_ERROR),
  v.safeInteger(LIMIT_ERROR),
  v.minValue(0, LIMIT_ERROR),
);

export function parseLimit(limit: number): LimitNode {
  const result = v.safeParse(limitSchema, limit);

  if (!result.success) {
    throw new RangeError(result.issues[0].message);
  }

  return LimitNode.create(result.output);
}
