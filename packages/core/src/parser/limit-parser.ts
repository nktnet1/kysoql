import { LimitNode } from "../operation-node/limit-node.js";

export function parseLimit(limit: number): LimitNode {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError("SOQL LIMIT must be a non-negative safe integer.");
  }

  return LimitNode.create(limit);
}
