import type { AggregateFunctionNode } from "#src/operation-node/aggregate-function-node";
import type { AliasNode } from "#src/operation-node/alias-node";
import type { DateFunctionNode } from "#src/operation-node/date-function-node";
import type { FieldsFunctionNode } from "#src/operation-node/fields-function-node";
import type { RawNode } from "#src/operation-node/raw-node";
import type { ReferenceNode } from "#src/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#src/operation-node/relationship-subquery-node";
import type { TypeOfNode } from "#src/operation-node/type-of-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for one SELECT projection. */
export interface SelectionNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "SelectionNode";
  /** Selected expression represented by this node. */
  readonly selection:
    | AggregateFunctionNode
    | AliasNode
    | DateFunctionNode
    | FieldsFunctionNode
    | RawNode
    | ReferenceNode
    | RelationshipSubqueryNode
    | TypeOfNode;
}

export const SelectionNode = {
  create(
    selection:
      | AggregateFunctionNode
      | AliasNode
      | DateFunctionNode
      | FieldsFunctionNode
      | RawNode
      | ReferenceNode
      | RelationshipSubqueryNode
      | TypeOfNode,
  ): SelectionNode {
    return freeze({
      kind: "SelectionNode",
      selection,
    });
  },
};
