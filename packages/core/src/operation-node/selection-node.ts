import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { FieldsFunctionNode } from "#/operation-node/fields-function-node";
import type { RawNode } from "#/operation-node/raw-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import { freeze } from "#/util/object-utils";

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
