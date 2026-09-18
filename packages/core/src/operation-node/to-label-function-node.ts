import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface ToLabelFunctionNode {
  readonly kind: "ToLabelFunctionNode";
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
