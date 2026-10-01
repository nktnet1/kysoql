import type { ApexBindNode } from "#src/operation-node/apex-bind-node";
import { ValueNode } from "#src/operation-node/value-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a SET OPTIONS clause. */
export interface SetOptionsNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "SetOptionsNode";
  /** Data 360 dataspace value. */
  readonly dataspace?: ValueNode;
  /** Whether Data 360 queries should preserve empty strings. */
  readonly honorEmptyStrings?: boolean;
  /** Apex database query options encoded in `SET OPTIONS`. */
  readonly apexQueryOptions?: ApexBindNode;
}

export const SetOptionsNode = {
  create(options: {
    readonly dataspace?: string;
    readonly honorEmptyStrings?: boolean;
  }): SetOptionsNode {
    return freeze({
      kind: "SetOptionsNode",
      ...(options.dataspace === undefined
        ? {}
        : { dataspace: ValueNode.create(options.dataspace) }),
      ...(options.honorEmptyStrings === undefined
        ? {}
        : { honorEmptyStrings: options.honorEmptyStrings }),
    });
  },

  createApexQueryOptions(apexQueryOptions: ApexBindNode): SetOptionsNode {
    return freeze({
      kind: "SetOptionsNode",
      apexQueryOptions,
    });
  },
};
