import { freeze } from "#/util/object-utils";

export interface RawNode {
  readonly kind: "RawNode";
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
