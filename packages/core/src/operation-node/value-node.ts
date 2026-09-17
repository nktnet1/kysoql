import { freeze } from "../util/object-utils.js";

export interface ValueNode {
  readonly kind: "ValueNode";
  readonly value: unknown;
}

export const ValueNode = {
  create(value: unknown): ValueNode {
    return freeze({
      kind: "ValueNode",
      value,
    });
  },
};
