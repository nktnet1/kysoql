import { parseSoqlReference } from "#src/soql-identifier";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for an Apex bind reference. */
export interface ApexBindNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexBindNode";
  /** Identifier or reference name represented by this node. */
  readonly name: string;
}

export const ApexBindNode = {
  create(name: string): ApexBindNode {
    return freeze({
      kind: "ApexBindNode",
      name: parseSoqlReference(name),
    });
  },
};
