/**
 * @fileoverview The read and write side of threaded comments, over the
 * polymorphic `comments` / `comment_likes` tables in `lib/database/schema.ts`.
 *
 * ## The shape of a thread read
 *
 * One query, joined across `user` and `comment_likes`, returns every comment on
 * a resource with its author, its like count, and whether the viewer is one of
 * the people who liked it. Two things make that work in a single pass:
 *
 * - **Likes are joined, not counted in a second query.** The left join fans the
 *   rows out by like count, which is why the `GROUP BY comments.id` and the
 *   `count(comment_likes.user_id)` are both mandatory. The alternative — a
 *   count subquery per comment — is correct and much slower, and the join is
 *   safe here precisely because a like row is small and indexed.
 * - **The viewer's own like is part of the aggregate.** `max(case when …)`
 *   answers "is this one mine" in the same scan, so the client does not need a
 *   second round trip per comment to know which hearts to fill in.
 *
 * The rows come back flat and are nested by `debate-comments`' `buildCommentTree`,
 * the same pure function the UI uses — so the tree the server ships and the tree
 * the client would build are the same tree, and there is only one place where
 * "a reply whose parent is missing" is decided.
 *
 * ## Why a reply is checked against the resource
 *
 * `resolveReplyParent` is the one piece of validation that needs a query, and
 * it answers two questions at once: does this parent exist, and is it on the
 * same resource as the reply. Without the second, a caller can post a reply
 * whose `parentId` names a comment on a *different* video and graft their text
 * into someone else's thread — the comment renders under a video it has nothing
 * to do with, in a context its author never agreed to.
 *
 * @module lib/comments/queries
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  MAX_REPLY_DEPTH,
  buildCommentTree,
  type Comment,
  type CommentAuthor,
  type CommentResourceType,
  type CommentThreadResponse,
  type CommentViewer,
} from "debate-comments";

import type { getDBFromContext } from "@/lib/database/context";
import { commentLikes, comments, user } from "@/lib/database/schema";
import { isCommentId, type Parsed } from "./validation";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/**
 * How many comments one thread read will return.
 *
 * A thread is fetched whole rather than paginated, because a reply has to be
 * able to appear under its parent without a second request — that is the whole
 * affordance a threaded comment is. Past a few hundred comments, though, the
 * response stops being a discussion and becomes a payload, and the video watch
 * page is already carrying a transcript.
 *
 * So the read is capped, and takes the *newest* comments: a thread that has
 * run past the cap is one whose old end nobody is reading, while its new end is
 * what the person who just arrived came for. `truncated` says so out loud
 * rather than letting a silently short thread look like the whole story — see
 * `CommentThreadResponse.truncated` for what a reader is told.
 */
export const MAX_THREAD_ROWS = 500;

/** What a row looks like coming out of the joined thread query. */
interface ThreadRow {
  id: string;
  resourceType: string;
  resourceId: string;
  parentId: string | null;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  likeCount: number;
  viewerHasLiked: number;
}

/** Turns a joined row into the wire shape, hiding a deleted comment's text. */
function toComment(row: ThreadRow, resourceType: CommentResourceType, resourceId: string): Comment {
  const author: CommentAuthor = {
    id: row.authorId,
    name: row.authorName,
    imageUrl: row.authorImage,
  };

  return {
    id: row.id,
    resourceType,
    resourceId,
    parentId: row.parentId,
    // A deleted comment's body never leaves the database. The client renders a
    // placeholder off `deletedAt` alone, so there is nothing here it could use
    // — and a deleted post that is still readable in the DOM (or in a cached
    // response, or in devtools) has not been deleted at all.
    body: row.deletedAt ? "" : row.body,
    author,
    likeCount: row.deletedAt ? 0 : row.likeCount,
    viewerHasLiked: row.deletedAt ? false : row.viewerHasLiked === 1,
    createdAt: Math.floor(row.createdAt.getTime() / 1000),
    deletedAt: row.deletedAt ? Math.floor(row.deletedAt.getTime() / 1000) : null,
    replies: [],
  };
}

/**
 * A resource's whole thread, newest-last, plus who the server thinks is
 * reading it.
 *
 * Reading needs no session: a signed-out visitor gets every comment and a
 * `viewer` of `null`, which is what puts the sign-in prompt where the composer
 * would be. `viewerId` only decides whose hearts are already filled in.
 */
export async function getCommentThread(
  db: Db,
  {
    resourceType,
    resourceId,
    viewerId,
  }: { resourceType: CommentResourceType; resourceId: string; viewerId?: string | null },
): Promise<CommentThreadResponse> {
  const rows = await db
    .select({
      id: comments.id,
      resourceType: comments.resourceType,
      resourceId: comments.resourceId,
      parentId: comments.parentId,
      body: comments.body,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorImage: user.image,
      likeCount: sql<number>`count(${commentLikes.userId})`,
      // An empty string matches no user id, so a signed-out read gets 0 here
      // without a second code path — and the value is still bound, not
      // interpolated.
      viewerHasLiked: sql<number>`max(case when ${commentLikes.userId} = ${viewerId ?? ""} then 1 else 0 end)`,
    })
    .from(comments)
    .innerJoin(user, eq(comments.authorId, user.id))
    .leftJoin(commentLikes, eq(commentLikes.commentId, comments.id))
    .where(and(eq(comments.resourceType, resourceType), eq(comments.resourceId, resourceId)))
    .groupBy(comments.id)
    // Newest first, so the cap below can be reached with a `LIMIT` and the cut
    // falls off the *old* end of the thread — the end nobody came to read.
    // The result is flipped back to oldest-first before it is nested, because
    // that is the order a conversation is read in.
    .orderBy(sql`${comments.createdAt} desc`)
    .limit(MAX_THREAD_ROWS + 1);

  // One row over the cap means there is more thread than fits; the extra row is
  // the proof, and is dropped.
  const truncated = rows.length > MAX_THREAD_ROWS;
  const page = truncated ? rows.slice(0, MAX_THREAD_ROWS) : rows;
  const ordered = [...page].reverse();

  const tree = buildCommentTree(
    ordered.map((row) => toComment(row as ThreadRow, resourceType, resourceId)),
  );

  return {
    comments: tree,
    viewer: await hydrateViewer(db, viewerId),
    totalCount: tree.reduce((total, comment) => total + 1 + countNested(comment.replies), 0),
    truncated,
  };
}

/** How many comments a nested branch holds, for `totalCount`. */
function countNested(nodes: readonly Comment[]): number {
  let total = 0;
  for (const node of nodes) total += 1 + countNested(node.replies);
  return total;
}

/** The viewer's public display fields — the only user columns comments expose. */
async function hydrateViewer(db: Db, viewerId: string | null | undefined): Promise<CommentViewer | null> {
  if (!viewerId) return null;

  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, viewerId))
    .limit(1);

  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image };
}

/** One step up the reply chain; see {@link resolveReplyParent}. */
interface AncestorRow {
  id: string;
  parentId: string | null;
  resourceType: string;
  resourceId: string;
  deletedAt: Date | null;
}

/**
 * Checks that a reply's parent is a live comment on the same resource, and how
 * deep the reply would land.
 *
 * Returns the resolved parent on success, or the message to answer with — which
 * covers all four ways a reply can be wrong: no such parent, a parent on a
 * different resource (see this module's header), a parent that has been
 * deleted, and a parent already at the depth ceiling.
 *
 * `depth` is the level the new reply would sit at, counting a top-level
 * comment as level 1 — the same numbering `CommentRow` uses, one less, for
 * its zero-based `depth` prop. Refusing on `MAX_REPLY_DEPTH` is what keeps a
 * walk that is following `parent_id` links from being able to run forever: the
 * chain is abandoned at the ceiling instead of followed past it.
 */
export async function resolveReplyParent(
  db: Db,
  parent: Parsed<string | null>,
  resource: { resourceType: CommentResourceType; resourceId: string },
): Promise<Parsed<{ parentId: null } | { parentId: string; depth: number }>> {
  if (!parent.ok) return parent;
  if (parent.value === null) return { ok: true, value: { parentId: null } };
  if (!isCommentId(parent.value)) {
    return { ok: false, error: "That is not a comment this reply could answer." };
  }

  // Walk from the named comment up to its root, checking at each step that the
  // whole chain is on this resource. A parent id that names a comment on
  // another video fails on the first step.
  let cursor: string | null = parent.value;
  // The level the new reply would sit at, counting a top-level comment as
  // level 1. The walk starts at 1 and adds a level per comment it steps up
  // through, so the last step — landing on the root — is the one that fixes
  // the answer. That is also what bounds the walk: the check below stops at the
  // ceiling instead of following `parent_id` past it.
  let level = 1;

  while (cursor) {
    // Annotated rather than inferred: `cursor` is reassigned from this row's
    // `parentId` on the next pass, so letting the compiler derive the row type
    // from a query bound to `cursor` is a cycle it resolves to `any`.
    const [row]: AncestorRow[] = await db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        resourceType: comments.resourceType,
        resourceId: comments.resourceId,
        deletedAt: comments.deletedAt,
      })
      .from(comments)
      .where(eq(comments.id, cursor))
      .limit(1);

    if (!row) {
      return { ok: false, error: "The comment you are replying to is gone." };
    }
    if (row.resourceType !== resource.resourceType || row.resourceId !== resource.resourceId) {
      return { ok: false, error: "That is not a comment on this page." };
    }
    if (row.deletedAt) {
      return { ok: false, error: "The comment you are replying to was deleted." };
    }

    cursor = row.parentId;
    level += 1;

    if (level > MAX_REPLY_DEPTH) {
      return {
        ok: false,
        error: `Replies can be nested up to ${MAX_REPLY_DEPTH} levels deep. Start a new comment instead.`,
      };
    }
  }

  return { ok: true, value: { parentId: parent.value, depth: level } };
}

/** Writes one comment and reads it back in the wire shape. */
export async function insertComment(
  db: Db,
  {
    resourceType,
    resourceId,
    parentId,
    authorId,
    body,
    id,
  }: {
    resourceType: CommentResourceType;
    resourceId: string;
    parentId: string | null;
    authorId: string;
    body: string;
    id: string;
  },
): Promise<Comment> {
  await db.insert(comments).values({ id, resourceType, resourceId, parentId, authorId, body });

  const [row] = await db
    .select({
      id: comments.id,
      resourceType: comments.resourceType,
      resourceId: comments.resourceId,
      parentId: comments.parentId,
      body: comments.body,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      authorId: user.id,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(comments)
    .innerJoin(user, eq(comments.authorId, user.id))
    .where(eq(comments.id, id))
    .limit(1);

  if (!row) {
    // The insert either threw or wrote nothing. Nothing was sent, so a client
    // that has not yet shown the comment has nothing to undo.
    throw new Error("The comment could not be saved.");
  }

  return toComment(
    {
      ...(row as Omit<ThreadRow, "likeCount" | "viewerHasLiked">),
      likeCount: 0,
      viewerHasLiked: 0,
    },
    resourceType,
    resourceId,
  );
}

/**
 * Flips the viewer's like on a comment and returns the resulting state.
 *
 * The count is read back from the table rather than computed as "previous plus
 * one", which is what makes a double-click, two tabs, or two people liking at
 * the same moment all land on a number the table can actually justify.
 */
export async function toggleCommentLike(
  db: Db,
  { commentId, userId }: { commentId: string; userId: string },
): Promise<Parsed<{ liked: boolean; likeCount: number }>> {
  if (!isCommentId(commentId)) {
    return { ok: false, error: "That is not a comment." };
  }

  const [target] = await db
    .select({ id: comments.id, deletedAt: comments.deletedAt })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!target) return { ok: false, error: "That comment no longer exists." };
  if (target.deletedAt) return { ok: false, error: "That comment was deleted." };

  const existing = await db
    .select({ userId: commentLikes.userId })
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .limit(1);

  const liked = existing.length === 0;
  if (liked) {
    await db.insert(commentLikes).values({ commentId, userId });
  } else {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
  }

  const [counted] = await db
    .select({ total: sql<number>`count(*)` })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));

  return { ok: true, value: { liked, likeCount: Number(counted?.total ?? 0) } };
}

/**
 * Removes one of the viewer's own comments, and says whether it was allowed.
 *
 * Soft delete: the body is blanked and `deletedAt` stamped, and the row stays,
 * because the replies underneath it do not belong to the comment being removed.
 * A deleted comment also cannot be liked or replied to any more — both of those
 * return through the same "was deleted" check above.
 */
export async function deleteOwnComment(
  db: Db,
  { commentId, userId }: { commentId: string; userId: string },
): Promise<Parsed<{ deleted: true }>> {
  if (!isCommentId(commentId)) {
    return { ok: false, error: "That is not a comment." };
  }

  const [row] = await db
    .select({ authorId: comments.authorId, deletedAt: comments.deletedAt })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!row || row.deletedAt) {
    return { ok: false, error: "That comment no longer exists." };
  }
  if (row.authorId !== userId) {
    return { ok: false, error: "You can only delete your own comments." };
  }

  await db
    .update(comments)
    .set({ body: "", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(comments.id, commentId));

  return { ok: true, value: { deleted: true } };
}

/**
 * How many comments a resource has, for surfaces that show a count without
 * fetching the thread (a tab label, a card badge).
 */
export async function countCommentsForResource(
  db: Db,
  resource: { resourceType: CommentResourceType; resourceId: string },
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(comments)
    .where(
      and(
        eq(comments.resourceType, resource.resourceType),
        eq(comments.resourceId, resource.resourceId),
        isNull(comments.deletedAt),
      ),
    );

  return Number(row?.total ?? 0);
}
