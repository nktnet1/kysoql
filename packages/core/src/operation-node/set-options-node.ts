import type { ApexBindNode } from "#/operation-node/apex-bind-node";
import { ValueNode } from "#/operation-node/value-node";
import { freeze } from "#/util/object-utils";

export interface SetOptionsNode {
  readonly kind: "SetOptionsNode";
  readonly dataspace?: ValueNode;
  readonly honorEmptyStrings?: boolean;
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
