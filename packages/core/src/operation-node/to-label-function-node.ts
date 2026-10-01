import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a toLabel() expression. */
export interface ToLabelFunctionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ToLabelFunctionNode";
  /** Field or relationship reference passed to the expression. */
  readonly reference: ReferenceNode;
}

export const ToLabelFunctionNode = {
  create(reference: ReferenceNode): ToLabelFunctionNode {
    return freeze({
      kind: "ToLabelFunctionNode",
      reference,
    });
  },
};
