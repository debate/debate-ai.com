/**
 * @fileoverview The comment feature as a package: one thread UI, mounted
 * against any resource.
 *
 * A surface adopts comments by rendering {@link CommentSection} and naming
 * what it is:
 *
 * ```tsx
 * import { CommentSection } from "@debate/comments";
 *
 * <CommentSection resourceType="video" resourceId={videoId} />
 * ```
 *
 * There is nothing else to wire. The component talks to `/api/comments` (see
 * `client.ts`), which stores every resource's discussion in one polymorphic
 * table, so adding a second surface means mounting this again — not a second
 * schema, a second route, or a second set of components.
 *
 * @module debate-comments
 */

export { CommentSection, type CommentSectionProps } from "./CommentSection";
export { CommentRow, type CommentRowProps } from "./CommentRow";
export { CommentComposer, type CommentComposerProps } from "./CommentComposer";
export { CommentAvatar, type CommentAvatarProps } from "./CommentAvatar";

export {
  createComment,
  deleteComment,
  fetchCommentThread,
  toggleCommentLike,
  type CommentClientOptions,
  type NewComment,
  type ThreadQuery,
} from "./client";

export {
  buildCommentTree,
  countComments,
  countReplies,
  findComment,
  flattenCommentTree,
  insertReplyNode,
  updateCommentNode,
} from "./tree";

export {
  formatAbsoluteTime,
  formatRelativeTime,
  getInitials,
  replyToggleLabel,
} from "./format";

export {
  COMMENT_RESOURCE_TYPES,
  DELETED_COMMENT_PLACEHOLDER,
  MAX_COMMENT_BODY_LENGTH,
  MAX_REPLY_DEPTH,
  isCommentResourceType,
  type Comment,
  type CommentAuthor,
  type CommentResourceType,
  type CommentThreadResponse,
  type CommentViewer,
} from "./types";
