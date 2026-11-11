/**
 * @fileoverview The read and write side of the forums, over the
 * `forum_threads` table in `lib/database/schema.ts`.
 *
 * ## The shape of a feed read
 *
 * One query, joined across `user` and `comments`, returns a page of threads with
 * their authors and their reply counts. The comment join is a left join on
 * `(resource_type = 'thread', resource_id = thread.id)` with a `GROUP BY` on
 * the thread, which is what makes a thread with no replies come back with a
 * count of zero instead of vanishing — the same aggregate the comment thread
 * read uses, for the same reason (see `lib/comments/queries.ts`).
 *
 * ## Ordering, and why `last_activity_at` is a column
 *
 * The feed is ordered by when a thread was last posted to, which is the only
 * order in which "latest" means anything once replies exist: a question from
 * March that twenty people answered yesterday is the newest thing on the forum.
 * That value is written on every reply ({@link touchThreadActivity}) instead of
 * being computed as `max(comments.created_at)` at read time, so the page is
 * served from `idx_forum_threads_activity` rather than sorting the whole table
 * on every request. A thread with no replies carries its own creation time.
 *
 * The pagination cursor is that same pair — `(lastActivityAt, id)` — because
 * two threads posted in the same second have no other order between them, and a
 * cursor that could not break that tie would either skip a row or repeat one
 * across pages.
 *
 * ## Categories, orders and thread likes
 *
 * A feed read can be narrowed to one board (`category`, served from
 * `idx_forum_threads_category`) and read in one of three orders: `active`
 * (the above), `new` (`created_at`) and `top` (`like_count`). The cursor is
 * the same `(key, id)` pair in every order — only which column `key` names
 * changes — so one encoding and one walk serve all three. `like_count` is a
 * column for the same reason `last_activity_at` is: it is rewritten from a
 * `count(*)` of `forum_thread_likes` on every toggle, so the top feed can page
 * through an index instead of sorting an aggregate.
 *
 * @module lib/forums/queries
 */

import { and, desc, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import {
  DEFAULT_FORUM_CATEGORY,
  DEFAULT_FORUM_SORT,
  FORUM_EXCERPT_LENGTH,
  isForumCategoryId,
  type ForumCategoryId,
  type ForumSort,
  type ForumThreadLikeResult,
  type ForumAuthor,
  type ForumFeedResponse,
  type ForumThreadDetail,
  type ForumThreadSummary,
  type ForumViewer,
} from "@debate-ai/comments/forums/types";

import type { getDBFromContext } from "@/lib/database/context";
import { comments, forumThreadLikes, forumThreads, user } from "@/lib/database/schema";
import { isThreadId, type Parsed } from "@debate-ai/comments/forums/validation";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/**
 * The resource type a comment carries when it is a forum reply.
 *
 * Restated here rather than read off `COMMENT_RESOURCE_TYPES` because the
 * comments package's list is the *client's* vocabulary (it also names video,
 * file and lecture, which have nothing to do with this table) and a forum
 * query that reached into it for its one member would be a coupling that reads
 * as a coincidence. `debate-comments` and this module must agree on the string;
 * the comments module documents that they do.
 */
const THREAD_COMMENT_TYPE = "thread";

/** A joined feed row, before it becomes the wire shape. */
interface FeedRow {
  id: string;
  title: string;
  body: string;
  category: string;
  likeCount: number;
  viewerHasLiked: number | boolean | null;
  createdAt: Date;
  lastActivityAt: Date;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  replyCount: number;
}

/**
 * The projection shared by the feed and the single-thread read.
 *
 * A function of the viewer because "has the viewer liked this" is a correlated
 * `exists` on `forum_thread_likes` — a subquery rather than a third join, which
 * would multiply the reply rows the `sum()` below counts.
 */
const threadColumns = (viewerId: string | null | undefined) => ({
  id: forumThreads.id,
  title: forumThreads.title,
  body: forumThreads.body,
  category: forumThreads.category,
  likeCount: forumThreads.likeCount,
  viewerHasLiked: viewerId
    ? sql<number>`exists (select 1 from ${forumThreadLikes} where ${forumThreadLikes.threadId} = ${forumThreads.id} and ${forumThreadLikes.userId} = ${viewerId})`
    : sql<number>`0`,
  createdAt: forumThreads.createdAt,
  lastActivityAt: forumThreads.lastActivityAt,
  authorId: user.id,
  authorName: user.name,
  authorImage: user.image,
  // A reply that has been soft-deleted still occupies a row, and is not
  // something a reader arriving at the thread can read — so it is excluded from
  // the count the feed shows, the same way `countCommentsForResource` does.
  replyCount: sql<number>`sum(case when ${comments.deletedAt} is null then 1 else 0 end)`,
});

/** The join that puts each thread's replies beside it, counted not fanned out. */
const repliesOfThread = and(
  eq(comments.resourceType, THREAD_COMMENT_TYPE),
  eq(comments.resourceId, forumThreads.id),
);

/** Unix seconds, the way every timestamp crosses the wire. */
function toWireTime(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

/**
 * Cuts an opening post down to {@link FORUM_EXCERPT_LENGTH} for the feed.
 *
 * The cut lands on whitespace when there is any near the limit, so a preview
 * ends on a word rather than mid-word; a post with no whitespace in that window
 * (a pasted table row, a URL) is cut exactly at the limit, because breaking one
 * of those anywhere is worse than breaking it at a character.
 */
function toExcerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= FORUM_EXCERPT_LENGTH) return flat;

  const window = flat.slice(0, FORUM_EXCERPT_LENGTH);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > FORUM_EXCERPT_LENGTH / 2 ? window.slice(0, lastSpace) : window;
  return `${cut}…`;
}

function toAuthor(row: { authorId: string; authorName: string; authorImage: string | null }): ForumAuthor {
  return { id: row.authorId, name: row.authorName, imageUrl: row.authorImage };
}

function toSummary(row: FeedRow): ForumThreadSummary {
  return {
    id: row.id,
    title: row.title,
    excerpt: toExcerpt(row.body),
    // A row written by hand, or one whose board was later retired, is shown
    // under General rather than under a label with no page behind it.
    category: isForumCategoryId(row.category) ? row.category : DEFAULT_FORUM_CATEGORY,
    author: toAuthor(row),
    likeCount: Number(row.likeCount ?? 0),
    viewerHasLiked: Boolean(Number(row.viewerHasLiked ?? 0)),
    // `sum()` over a left join with no matching row is NULL, and `Number(null)`
    // is 0 — but going through `?? 0` says which of the two was meant, and
    // keeps a 0 from ever arriving as NaN.
    replyCount: Number(row.replyCount ?? 0),
    createdAt: toWireTime(row.createdAt),
    lastActivityAt: toWireTime(row.lastActivityAt),
  };
}

/**
 * A page of the forum, newest activity first, and who the server thinks is
 * reading it.
 *
 * Reading needs no session: a signed-out visitor gets every thread and a
 * `viewer` of `null`, which is what puts the sign-in prompt where the
 * new-thread form would be.
 */
export async function listForumThreads(
  db: Db,
  {
    limit,
    cursor,
    viewerId,
    category = null,
    sort = DEFAULT_FORUM_SORT,
  }: {
    limit: number;
    cursor: ForumCursor | null;
    viewerId?: string | null;
    category?: ForumCategoryId | null;
    sort?: ForumSort;
  },
): Promise<ForumFeedResponse> {
  const key = sortKey(sort);

  // One row past the limit is how the response knows there is a next page,
  // rather than a second count query over the table.
  const rows = await db
    .select(threadColumns(viewerId))
    .from(forumThreads)
    .innerJoin(user, eq(forumThreads.authorId, user.id))
    .leftJoin(comments, repliesOfThread)
    .where(
      and(
        isNull(forumThreads.deletedAt),
        category ? eq(forumThreads.category, category) : undefined,
        cursor ? afterCursor(cursor, sort) : undefined,
      ),
    )
    .groupBy(forumThreads.id)
    .orderBy(desc(key), desc(forumThreads.id))
    .limit(limit + 1);

  // Annotated rather than left to the query builder's inference: the aggregate
  // in `threadColumns` widens the row type past what this function wants to
  // reason about, and the cast is where the shape is pinned down instead.
  const page = rows.slice(0, limit) as FeedRow[];
  const last = page.at(-1);
  const hasMore = rows.length > limit;

  return {
    threads: page.map((row) => toSummary(row)),
    viewer: await hydrateViewer(db, viewerId),
    nextCursor: hasMore && last ? encodeCursor(cursorKeyOf(last, sort), last.id) : null,
    category,
    sort,
  };
}

/** The column a feed order sorts on, before the `id` tie-break. */
function sortKey(sort: ForumSort) {
  if (sort === "new") return forumThreads.createdAt;
  if (sort === "top") return forumThreads.likeCount;
  return forumThreads.lastActivityAt;
}

/** The cursor half of a row: the value of the column its feed order sorts on. */
function cursorKeyOf(row: FeedRow, sort: ForumSort): number {
  if (sort === "new") return toWireTime(row.createdAt);
  if (sort === "top") return Number(row.likeCount ?? 0);
  return toWireTime(row.lastActivityAt);
}

/** One thread, opening post whole, or `null` if it is gone or was removed. */
export async function getForumThread(
  db: Db,
  { threadId, viewerId }: { threadId: string; viewerId?: string | null },
): Promise<ForumThreadDetail | null> {
  if (!isThreadId(threadId)) return null;

  const [row] = await db
    .select(threadColumns(viewerId))
    .from(forumThreads)
    .innerJoin(user, eq(forumThreads.authorId, user.id))
    .leftJoin(comments, repliesOfThread)
    .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt)))
    .groupBy(forumThreads.id)
    .limit(1);

  if (!row) return null;
  return { ...toSummary(row as FeedRow), body: (row as FeedRow).body };
}

/** Writes one thread and reads it back in the wire shape. */
export async function insertForumThread(
  db: Db,
  {
    title,
    body,
    authorId,
    id,
    category = DEFAULT_FORUM_CATEGORY,
  }: { title: string; body: string; authorId: string; id: string; category?: ForumCategoryId },
): Promise<ForumThreadDetail> {
  // Written explicitly rather than left to the column defaults: the feed orders
  // on `lastActivityAt`, and a default that resolved a second later than
  // `createdAt` would put a brand new thread behind every thread opened in that
  // same second.
  const now = new Date();

  await db.insert(forumThreads).values({
    id,
    title,
    body,
    category,
    authorId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  });

  const created = await getForumThread(db, { threadId: id, viewerId: authorId });
  if (!created) {
    // The insert either threw or wrote nothing, so a client that has not shown
    // the thread yet has nothing to undo.
    throw new Error("The thread could not be saved.");
  }

  return created;
}

/**
 * Moves a thread to the top of the feed because somebody replied to it.
 *
 * Called from the comment insert path rather than from a forum route, because a
 * reply is posted through `/api/comments` like every other comment — see
 * `lib/comments/queries.ts#insertComment`. It is one indexed write on a row
 * that already exists, and it is what makes "latest" mean the newest thing that
 * *happened* rather than the newest thing that was opened.
 *
 * A reply to an id that is not a live thread updates nothing: comments are
 * polymorphic, and only the `thread` kind has a row here to move.
 */
export async function touchThreadActivity(db: Db, threadId: string): Promise<void> {
  const now = new Date();
  await db
    .update(forumThreads)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt)));
}

/**
 * Flips one member's like on a thread's opening post, and answers with the
 * state the rows hold afterwards — the same toggle contract as
 * `lib/comments/queries.ts#toggleCommentLike`.
 *
 * The count is re-read with `count(*)` and written back to
 * `forum_threads.like_count`, never incremented: two tabs, a double click and
 * two members liking the same thread at once all settle on a number the rows
 * support, and the "top" feed's index sees it.
 */
export async function toggleForumThreadLike(
  db: Db,
  { threadId, userId }: { threadId: string; userId: string },
): Promise<Parsed<ForumThreadLikeResult>> {
  if (!isThreadId(threadId)) {
    return { ok: false, error: "That is not a thread." };
  }

  const [target] = await db
    .select({ id: forumThreads.id })
    .from(forumThreads)
    .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt)))
    .limit(1);
  if (!target) return { ok: false, error: "That thread no longer exists." };

  const existing = await db
    .select({ userId: forumThreadLikes.userId })
    .from(forumThreadLikes)
    .where(and(eq(forumThreadLikes.threadId, threadId), eq(forumThreadLikes.userId, userId)))
    .limit(1);

  const liked = existing.length === 0;
  if (liked) {
    await db.insert(forumThreadLikes).values({ threadId, userId }).onConflictDoNothing();
  } else {
    await db
      .delete(forumThreadLikes)
      .where(and(eq(forumThreadLikes.threadId, threadId), eq(forumThreadLikes.userId, userId)));
  }

  const [counted] = await db
    .select({ total: sql<number>`count(*)` })
    .from(forumThreadLikes)
    .where(eq(forumThreadLikes.threadId, threadId));
  const likeCount = Number(counted?.total ?? 0);

  // Deliberately leaves `updatedAt` and `lastActivityAt` alone: a like is not
  // a post, and bumping the thread to the top of "active" for one would let a
  // like button stand in for a reply.
  await db.update(forumThreads).set({ likeCount }).where(eq(forumThreads.id, threadId));

  return { ok: true, value: { liked, likeCount } };
}

/** The viewer's public display fields — the only user columns the forum exposes. */
async function hydrateViewer(db: Db, viewerId: string | null | undefined): Promise<ForumViewer | null> {
  if (!viewerId) return null;

  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, viewerId))
    .limit(1);

  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image };
}

/** A decoded pagination cursor: the last row of the page before this one. */
export interface ForumCursor {
  /** Unix seconds. */
  at: number;
  id: string;
}

/**
 * Encodes the feed's position as an opaque string.
 *
 * Base64 rather than the raw `seconds.id`: the pair is two values with a
 * delimiter of our choosing, and a client that could write one could also
 * hand-craft an offset the feed never promised — which is harmless today (it
 * would only move the read window) and is exactly the kind of thing that
 * stops being harmless when a second consumer is added.
 */
export function encodeCursor(at: number, id: string): string {
  return btoa(`${at}.${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decodes a cursor, or says why it could not be used. */
export function decodeCursor(raw: unknown): Parsed<ForumCursor | null> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "That is not a page of the forum." };
  }

  let decoded: string;
  try {
    decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return { ok: false, error: "That is not a page of the forum." };
  }

  const separator = decoded.lastIndexOf(".");
  if (separator === -1) {
    return { ok: false, error: "That is not a page of the forum." };
  }

  const at = Number(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (!Number.isFinite(at) || !isThreadId(id)) {
    return { ok: false, error: "That is not a page of the forum." };
  }

  return { ok: true, value: { at, id } };
}

/**
 * The `WHERE` half of a cursor walk: strictly after the cursor row, in the
 * feed's order.
 *
 * Both halves are needed because the sort key is not unique — two threads
 * posted in the same second, or with the same number of likes, tie — and
 * comparing on the key alone would drop the tie-broken row from the next page.
 * The id comparison repeats the `ORDER BY`'s tie-break, which is what makes the
 * two halves the same order: `(key, id)` descending on both sides, and the walk
 * ends when the table does.
 */
export function afterCursor(cursor: ForumCursor, sort: ForumSort = DEFAULT_FORUM_SORT): SQL | undefined {
  if (sort === "top") {
    return or(
      lt(forumThreads.likeCount, cursor.at),
      and(eq(forumThreads.likeCount, cursor.at), lt(forumThreads.id, cursor.id)),
    );
  }
  // The timestamp columns are Drizzle timestamps and the cursor is Unix
  // seconds — the same unit boundary as everywhere else in this file,
  // converted once here rather than at each comparison.
  const column = sort === "new" ? forumThreads.createdAt : forumThreads.lastActivityAt;
  const at = new Date(cursor.at * 1000);
  return or(lt(column, at), and(eq(column, at), lt(forumThreads.id, cursor.id)));
}
