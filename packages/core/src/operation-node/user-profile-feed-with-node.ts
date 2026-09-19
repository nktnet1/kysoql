import { ValueNode } from "#/operation-node/value-node";
import { freeze } from "#/util/object-utils";

export interface UserProfileFeedWithNode {
  readonly kind: "UserProfileFeedWithNode";
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
