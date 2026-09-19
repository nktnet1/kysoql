import type { ReferenceNode } from "#/operation-node/reference-node";
import { freeze } from "#/util/object-utils";

export interface TypeOfWhenNode {
  readonly kind: "TypeOfWhenNode";
  readonly object: string;
  readonly selections: ReadonlyArray<ReferenceNode>;
}

export interface TypeOfNode {
  readonly kind: "TypeOfNode";
  readonly reference: ReferenceNode;
  readonly whens: ReadonlyArray<TypeOfWhenNode>;
  readonly elseSelections?: ReadonlyArray<ReferenceNode>;
}

const NON_EMPTY_BRANCH_ERROR =
  "SOQL TYPEOF branches must select at least one field.";
const DUPLICATE_WHEN_ERROR =
  "SOQL TYPEOF cannot contain duplicate WHEN object branches.";
const DUPLICATE_ELSE_ERROR = "SOQL TYPEOF can contain at most one ELSE branch.";

const createWhen = (
  object: string,
  selections: ReadonlyArray<ReferenceNode>,
): TypeOfWhenNode => {
  if (selections.length === 0) {
    throw new TypeError(NON_EMPTY_BRANCH_ERROR);
  }

  return freeze({
    kind: "TypeOfWhenNode",
    object,
    selections: freeze([...selections]),
  });
};

export const TypeOfNode = {
  create(reference: ReferenceNode): TypeOfNode {
    return freeze({
      kind: "TypeOfNode",
      reference,
      whens: freeze([]),
    });
  },

  cloneWithWhen(
    typeOf: TypeOfNode,
    object: string,
    selections: ReadonlyArray<ReferenceNode>,
  ): TypeOfNode {
    if (typeOf.elseSelections) {
      throw new TypeError("SOQL TYPEOF WHEN branches must appear before ELSE.");
    }

    if (typeOf.whens.some((when) => when.object === object)) {
      throw new TypeError(
        `${DUPLICATE_WHEN_ERROR} Duplicate object: ${object}.`,
      );
    }

    return freeze({
      ...typeOf,
      whens: freeze([...typeOf.whens, createWhen(object, selections)]),
    });
  },

  cloneWithElse(
    typeOf: TypeOfNode,
    selections: ReadonlyArray<ReferenceNode>,
  ): TypeOfNode {
    if (selections.length === 0) {
      throw new TypeError(NON_EMPTY_BRANCH_ERROR);
    }

    if (typeOf.elseSelections) {
      throw new TypeError(DUPLICATE_ELSE_ERROR);
    }

    return freeze({
      ...typeOf,
      elseSelections: freeze([...selections]),
    });
  },
};
