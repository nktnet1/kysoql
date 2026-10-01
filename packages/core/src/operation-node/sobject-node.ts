import { parseSoqlIdentifier } from "#src/soql-identifier";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a Salesforce object reference. */
export interface SObjectNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "SObjectNode";
  /** Identifier or reference name represented by this node. */
  readonly name: string;
}

export const SObjectNode = {
  create(name: string): SObjectNode {
    return freeze({
      kind: "SObjectNode",
      name: parseSoqlIdentifier(name),
    });
  },
};
