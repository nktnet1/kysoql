import { freeze } from "#/util/object-utils";

/** Immutable query AST node for a record-visibility context clause. */
export interface RecordVisibilityContextNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "RecordVisibilityContextNode";
  /** Maximum descriptor count requested for record visibility context. */
  readonly maxDescriptorPerRecord?: number;
  /** Whether domain visibility descriptors should be returned. */
  readonly supportsDomains?: boolean;
  /** Whether delegate visibility descriptors should be returned. */
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
