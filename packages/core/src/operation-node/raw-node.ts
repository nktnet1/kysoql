import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a trusted raw SOQL fragment. */
export interface RawNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "RawNode";
  /** Trusted SOQL fragment emitted verbatim. */
  readonly soql: string;
}

const rawNodes = new WeakSet<object>();

export const RawNode = {
  create(soql: string): RawNode {
    if (typeof soql !== "string") {
      throw new TypeError("SOQL raw fragments must be strings.");
    }

    const node = freeze({
      kind: "RawNode" as const,
      soql,
    });
    rawNodes.add(node);
    return node;
  },
};

export function isRawNode(node: RawNode): boolean {
  return rawNodes.has(node);
}
