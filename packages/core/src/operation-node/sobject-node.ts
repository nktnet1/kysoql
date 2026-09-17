import { freeze } from "#/util/object-utils";

export interface SObjectNode {
  readonly kind: "SObjectNode";
  readonly name: string;
}

export const SObjectNode = {
  create(name: string): SObjectNode {
    return freeze({
      kind: "SObjectNode",
      name,
    });
  },
};
