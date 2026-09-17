import { freeze } from "../util/object-utils.js";

export interface ReferenceNode {
  readonly kind: "ReferenceNode";
  readonly name: string;
}

export const ReferenceNode = {
  create(name: string): ReferenceNode {
    return freeze({
      kind: "ReferenceNode",
      name,
    });
  },
};
