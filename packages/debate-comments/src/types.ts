/**
 * @fileoverview The comment wire format, shared by the app's API routes and
 * this package's UI.
 *
 * Comments are stored once, polymorphically, for every kind of thing that can
 * be discussed: a video, an uploaded file, a lecture, a card contribution. One
 * `resourceType` + `resourceId` pair names the thing, so a second surface is a
 * mount of the same component rather than a second table and a second API.
 *
 * The tree is an adjacency list: every comment carries a `parentId` pointing
 * at the comment it answers, or `null` for a root. The server sends the tree
 * already nested (`replies`), because a client that has to rebuild it would
 * have to hold the whole thread flat anyway to do so — nesting on read keeps
 * the render path a straight walk of the response.
 *
 * @module types
 */

/** The kinds of resource a comment can hang off. */
export const COMMENT_RESOURCE_TYPES = ["video", "file", "lecture", "contribution"] as const;

export type CommentResourceType = (typeof COMMENT_RESOURCE_TYPES)[number];

/** Narrows an untrusted value (a query param, a JSON body) to a resource type. */
export function isCommentResourceType(value: unknown): value is CommentResourceType {
  return (
    typeof value === "string" && (COMMENT_RESOURCE_TYPES as readonly string[]).includes(value)
  );
}

/** Who wrote a comment. Only ever the public fields — never an email. */
export interface CommentAuthor {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** One comment, with its replies already nested underneath it. */
export interface Comment {
  id: string;
  resourceType: CommentResourceType;
  resourceId: string;
  parentId: string | null;
  body: string;
  author: CommentAuthor;
  likeCount: number;
  /** Whether the viewer who fetched this thread has already liked it. */
  viewerHasLiked: boolean;
  /** Unix seconds, as a number. */
  createdAt: number;
  /** Set once a comment is deleted: the body is gone but the replies remain. */
  deletedAt: number | null;
  replies: Comment[];
}

/**
 * The viewer as the API sees them, or `null` signed out. The UI needs this to
 * decide between a composer and a "sign in to comment" prompt, and to know
 * whose comments it may delete — which is why it rides along with the thread
 * rather than being a second request.
 */
export interface CommentViewer {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** What `GET /api/comments` returns: the thread, and who is reading it. */
export interface CommentThreadResponse {
  comments: Comment[];
  viewer: CommentViewer | null;
  /**
   * Every comment in the thread, roots and replies. Deleted ones count — they
   * still occupy a row in the conversation, and a header that counted fewer
   * comments than the page shows is a bug a reader can see.
   */
  totalCount: number;
  /**
   * The thread was longer than the server is willing to send in one response,
   * and `comments` holds its most recent {@link MAX_THREAD_ROWS} comments.
   *
   * A truncated thread is shown as one — "showing the latest N" — rather than
   * passed off as the whole discussion, because a silently shortened thread
   * reads as a thread that nobody replied to.
   */
  truncated: boolean;
}

/** The longest a comment body may be, in characters. Enforced on the server. */
export const MAX_COMMENT_BODY_LENGTH = 5000;

/**
 * How deep a reply may nest.
 *
 * The UI stops *offering* a reply button past this depth, and the server
 * refuses one too — but a thread is a social object, and a tree nobody can
 * escape the bottom of reads as broken rather than as tidy. Storage is an
 * adjacency list rather than a fixed number of columns precisely so this
 * ceiling can move without a migration.
 */
export const MAX_REPLY_DEPTH = 8;

/** The placeholder a deleted comment leaves behind. */
export const DELETED_COMMENT_PLACEHOLDER = "This comment was deleted.";
