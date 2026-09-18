import * as v from "valibot";

import { OffsetNode } from "#/operation-node/offset-node";

const OFFSET_ERROR = "SOQL OFFSET must be a safe integer between 0 and 2000.";
const offsetSchema = v.pipe(
  v.number(OFFSET_ERROR),
  v.safeInteger(OFFSET_ERROR),
  v.minValue(0, OFFSET_ERROR),
  v.maxValue(2000, OFFSET_ERROR),
);

export function parseOffset(offset: number): OffsetNode {
  const result = v.safeParse(offsetSchema, offset);

  if (!result.success) {
    throw new RangeError(result.issues[0].message);
  }

  return OffsetNode.create(result.output);
}
