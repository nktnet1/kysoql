import { freeze } from "#src/util/object-utils";

/**
 * Apex query access modes supported by Salesforce Database query methods.
 */
export type ApexAccessMode = "user" | "system";

/** Immutable query AST node for an Apex query access mode. */
export interface ApexAccessModeNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexAccessModeNode";
  /** Clause mode represented by this node. */
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
