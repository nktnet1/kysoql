import * as v from "valibot";

import type { SelectQueryNode } from "#src/operation-node/select-query-node";
import {
  UserProfileFeedWithNode,
  type UserProfileFeedWithNode as UserProfileFeedWithNodeType,
} from "#src/operation-node/user-profile-feed-with-node";

export type UserProfileFeedWithUserIdCheck<ObjectName> = [
  Exclude<ObjectName, "UserProfileFeed">,
] extends [never]
  ? readonly []
  : readonly [userProfileFeedOnly: never];

const USER_ID_ERROR =
  "SOQL UserProfileFeed WITH UserId requires a non-empty User ID string.";
const userIdSchema = v.pipe(
  v.string(USER_ID_ERROR),
  v.minLength(1, USER_ID_ERROR),
);

const validateUserId = (userId: unknown): string => {
  const result = v.safeParse(userIdSchema, userId);

  if (!result.success) {
    throw new TypeError(result.issues[0].message);
  }

  return result.output;
};

export const parseUserProfileFeedWithUserId = (
  userId: string,
): UserProfileFeedWithNodeType =>
  UserProfileFeedWithNode.create(validateUserId(userId));

export const validateUserProfileFeedQuery = (query: SelectQueryNode): void => {
  const isUserProfileFeed = query.from.name.toLowerCase() === "userprofilefeed";

  if (isUserProfileFeed && !query.userProfileFeedWith) {
    throw new TypeError(
      "SOQL UserProfileFeed queries require WITH UserId = <userId>.",
    );
  }

  if (!isUserProfileFeed && query.userProfileFeedWith) {
    throw new TypeError(
      "SOQL WITH UserId can only be used with UserProfileFeed queries.",
    );
  }

  if (query.userProfileFeedWith && query.withDataCategory) {
    throw new TypeError(
      "SOQL WITH UserId cannot be combined with WITH DATA CATEGORY.",
    );
  }

  if (query.userProfileFeedWith) {
    validateUserId(query.userProfileFeedWith.userId.value);
  }
};
