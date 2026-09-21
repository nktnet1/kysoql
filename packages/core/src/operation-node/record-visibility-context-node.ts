import { freeze } from "#/util/object-utils";

export interface RecordVisibilityContextNode {
  readonly kind: "RecordVisibilityContextNode";
  readonly maxDescriptorPerRecord?: number;
  readonly supportsDomains?: boolean;
  readonly supportsDelegates?: boolean;
}

export const RecordVisibilityContextNode = {
  create(parameters: {
    readonly maxDescriptorPerRecord?: number;
    readonly supportsDomains?: boolean;
    readonly supportsDelegates?: boolean;
  }): RecordVisibilityContextNode {
    return freeze({
      kind: "RecordVisibilityContextNode",
      ...parameters,
    });
  },
};
