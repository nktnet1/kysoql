import { parseSoqlReference } from "#/soql-identifier";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a field or relationship reference. */
export interface ReferenceNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ReferenceNode";
  /** Identifier or reference name represented by this node. */
  readonly name: string;
}

export const ReferenceNode = {
  create(name: string): ReferenceNode {
    return freeze({
      kind: "ReferenceNode",
      name: parseSoqlReference(name),
    });
  },
};
