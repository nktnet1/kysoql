import type { AggregateFunctionNode } from "#/operation-node/aggregate-function-node";
import type { AliasNode } from "#/operation-node/alias-node";
import type { DateFunctionNode } from "#/operation-node/date-function-node";
import type { FieldsFunctionNode } from "#/operation-node/fields-function-node";
import type { ReferenceNode } from "#/operation-node/reference-node";
import type { RelationshipSubqueryNode } from "#/operation-node/relationship-subquery-node";
import type { TypeOfNode } from "#/operation-node/type-of-node";
import { freeze } from "#/util/object-utils";

export interface SelectionNode {
  readonly kind: "SelectionNode";
  readonly selection:
    | AggregateFunctionNode
    | AliasNode
    | DateFunctionNode
    | FieldsFunctionNode
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
