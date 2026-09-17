import { freeze } from "../util/object-utils.js";

export interface LimitNode {
  readonly kind: "LimitNode";
  readonly limit: number;
}

export const LimitNode = {
  create(limit: number): LimitNode {
    return freeze({
      kind: "LimitNode",
      limit,
    });
  },
};
