import { parseSoqlIdentifier } from "#/soql-identifier";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a USING SCOPE clause. */
export interface UsingScopeNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "UsingScopeNode";
  /** `USING SCOPE` value. */
  readonly scope: string;
}

export const UsingScopeNode = {
  create(scope: string): UsingScopeNode {
    return freeze({
      kind: "UsingScopeNode",
      scope: parseSoqlIdentifier(scope),
    });
  },
};
