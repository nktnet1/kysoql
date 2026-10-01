import { ValueNode } from "#src/operation-node/value-node";
import { freeze } from "#src/util/object-utils";

/** Immutable query AST node for a UserProfileFeed WITH clause. */
export interface UserProfileFeedWithNode {
  /** Node discriminator used by Kysoql compilers and plugin visitors. */
  readonly kind: "UserProfileFeedWithNode";
  /** User ID emitted by the UserProfileFeed `WITH USER_ID` clause. */
  readonly userId: ValueNode;
}

export const UserProfileFeedWithNode = {
  create(userId: string): UserProfileFeedWithNode {
    return freeze({
      kind: "UserProfileFeedWithNode",
      userId: ValueNode.create(userId),
    });
  },
};
