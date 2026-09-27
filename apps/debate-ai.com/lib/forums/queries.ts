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
 * @module lib/forums/queries
 */

import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import {
  FORUM_EXCERPT_LENGTH,
  type ForumAuthor,
  type ForumFeedResponse,
  type ForumThreadDetail,
  type ForumThreadSummary,
  type ForumViewer,
} from "debate-webview/lib/forums/types";

import type { getDBFromContext } from "@/lib/database/context";
import { comments, forumThreads, user } from "@/lib/database/schema";
import { isThreadId, type Parsed } from "./validation";

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
  createdAt: Date;
  lastActivityAt: Date;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  replyCount: number;
}

/** The projection shared by the feed and the single-thread read. */
const threadColumns = {
  id: forumThreads.id,
  title: forumThreads.title,
  body: forumThreads.body,
  createdAt: forumThreads.createdAt,
  lastActivityAt: forumThreads.lastActivityAt,
  authorId: user.id,
  authorName: user.name,
  authorImage: user.image,
  // A reply that has been soft-deleted still occupies a row, and is not
  // something a reader arriving at the thread can read — so it is excluded from
  // the count the feed shows, the same way `countCommentsForResource` does.
  replyCount: sql<number>`sum(case when ${comments.deletedAt} is null then 1 else 0 end)`,
};

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
    author: toAuthor(row),
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
  }: { limit: number; cursor: string | null; viewerId?: string | null },
): Promise<ForumFeedResponse> {
  // One row past the limit is how the response knows there is a next page,
  // rather than a second count query over the table.
  const rows = await db
    .select(threadColumns)
    .from(forumThreads)
    .innerJoin(user, eq(forumThreads.authorId, user.id))
    .leftJoin(comments, repliesOfThread)
    .where(and(isNull(forumThreads.deletedAt), cursor ? afterCursor(cursor) : undefined))
    .groupBy(forumThreads.id)
    .orderBy(desc(forumThreads.lastActivityAt), desc(forumThreads.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const hasMore = rows.length > limit;

  return {
    threads: page.map((row) => toSummary(row as FeedRow)),
    viewer: await hydrateViewer(db, viewerId),
    nextCursor:
      hasMore && last ? encodeCursor(toWireTime((last as FeedRow).lastActivityAt), last.id) : null,
  };
}

/** One thread, opening post whole, or `null` if it is gone or was removed. */
export async function getForumThread(
  db: Db,
  { threadId }: { threadId: string },
): Promise<ForumThreadDetail | null> {
  if (!isThreadId(threadId)) return null;

  const [row] = await db
    .select(threadColumns)
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
  }: { title: string; body: string; authorId: string; id: string },
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
    authorId,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  });

  const created = await getForumThread(db, { threadId: id });
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
 * The `WHERE` half of a cursor walk: strictly after the cursor row.
 *
 * Both halves are needed because `lastActivityAt` is only unique to the second
 * — two threads posted in the same second tie, and comparing on the timestamp
 * alone would drop the tie-broken row from the next page. The id comparison
 * repeats the `ORDER BY`'s tie-break, which is what makes the two halves the
 * same order: `(at, id)` descending on both sides, and the walk ends when the
 * table does.
 */
export function afterCursor(cursor: ForumCursor) {
  return or(
    lt(forumThreads.lastActivityAt, cursor.at),
    and(eq(forumThreads.lastActivityAt, cursor.at), lt(forumThreads.id, cursor.id)),
  );
}
