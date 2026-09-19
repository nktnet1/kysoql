import { freeze } from "#/util/object-utils";

export interface UsingScopeNode {
  readonly kind: "UsingScopeNode";
  readonly scope: string;
}

export const UsingScopeNode = {
  create(scope: string): UsingScopeNode {
    return freeze({
      kind: "UsingScopeNode",
      scope,
    });
  },
};
