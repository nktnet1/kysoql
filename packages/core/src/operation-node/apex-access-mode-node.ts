import { freeze } from "#/util/object-utils";

export type ApexAccessMode = "user" | "system";

export interface ApexAccessModeNode {
  readonly kind: "ApexAccessModeNode";
  readonly mode: ApexAccessMode;
}

export const ApexAccessModeNode = {
  create(mode: ApexAccessMode): ApexAccessModeNode {
    return freeze({
      kind: "ApexAccessModeNode",
      mode,
    });
  },
};
