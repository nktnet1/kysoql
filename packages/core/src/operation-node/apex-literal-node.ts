import { freeze } from "#src/util/object-utils";

/** Primitive literal values supported inside Apex bind expressions. */
export type ApexLiteralValue = string | number;

/** Immutable query AST node for an Apex literal value. */
export interface ApexLiteralNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "ApexLiteralNode";
  /** Literal value represented by this node. */
  readonly value: ApexLiteralValue;
}

export const ApexLiteralNode = {
  create(value: ApexLiteralValue): ApexLiteralNode {
    return freeze({
      kind: "ApexLiteralNode",
      value,
    });
  },
};
