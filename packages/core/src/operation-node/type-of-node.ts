import type { ReferenceNode } from "#/operation-node/reference-node";
import { parseSoqlIdentifier } from "#/soql-identifier";
import { freeze } from "#/util/object-utils";

/** Immutable query AST node for one TYPEOF WHEN branch. */
export interface TypeOfWhenNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "TypeOfWhenNode";
  /** Salesforce object referenced by this branch or relationship. */
  readonly object: string;
  /** Selections emitted by this query or subquery. */
  readonly selections: ReadonlyArray<ReferenceNode>;
}

/** Immutable query AST node for a TYPEOF selection. */
export interface TypeOfNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "TypeOfNode";
  /** Field or relationship reference passed to the expression. */
  readonly reference: ReferenceNode;
  /** `WHEN` branches in a `TYPEOF` expression. */
  readonly whens: ReadonlyArray<TypeOfWhenNode>;
  /** Selections emitted by the optional `TYPEOF ELSE` branch. */
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
    object: parseSoqlIdentifier(object),
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
