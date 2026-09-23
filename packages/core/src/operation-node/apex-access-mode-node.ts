import { freeze } from "#/util/object-utils";

export type ApexAccessMode = "user" | "system";

export interface ApexAccessModeNode {
  readonly kind: "ApexAccessModeNode";
  readonly mode: ApexAccessMode;
}

export const ApexAccessModeNode = {
  create(mode: ApexAccessMode): ApexAccessModeNode {
    if (mode !== "user" && mode !== "system") {
      throw new TypeError("Apex SOQL access mode must be user or system.");
    }

    return freeze({
      kind: "ApexAccessModeNode",
      mode,
    });
  },
};
