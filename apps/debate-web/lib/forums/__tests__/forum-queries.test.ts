/**
 * @fileoverview `lib/forums/queries.ts` against a real SQLite database: the
 * feed's three orders and their cursor walks (no row skipped or repeated, even
 * across ties), board filtering, reply counts that ignore deleted replies,
 * excerpts, likes, activity bumps, and soft-deleted threads.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import {
  decodeCursor,
  getForumThread,
  insertForumThread,
  listForumThreads,
  toggleForumThreadLike,
  touchThreadActivity,
} from "../queries";
import type { ForumSort } from "@debate-ai/comments/forums/types";

let db: ReturnType<typeof drizzle<typeof schema>>;

/** A v4-shaped UUID whose last group sorts by `n`. */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function thread(n: number, opts: { at?: number; created?: number; likes?: number; category?: string; body?: string; author?: string } = {}) {
  const created = new Date((opts.created ?? opts.at ?? 1_700_000_000 + n) * 1000);
  await db.insert(schema.forumThreads).values({
    id: uuid(n),
    title: `Thread ${n}`,
    body: opts.body ?? `Body of ${n}`,
    category: opts.category ?? "general",
    likeCount: opts.likes ?? 0,
    authorId: opts.author ?? "ana",
    createdAt: created,
    updatedAt: created,
    lastActivityAt: new Date((opts.at ?? 1_700_000_000 + n) * 1000),
  });
}

async function reply(threadN: number, n: number, deleted = false) {
  await db.insert(schema.comments).values({
    id: `c${threadN}-${n}`,
    resourceType: "thread",
    resourceId: uuid(threadN),
    authorId: "ben",
    body: "reply",
    deletedAt: deleted ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);
}

/** Every thread id in feed order, walking the cursor `limit` rows at a time. */
async function walk(sort: ForumSort, limit: number, category: string | null = null) {
  const ids: string[] = [];
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const res = await listForumThreads(db, { limit, cursor, sort, category: category as never });
    ids.push(...res.threads.map((t) => t.id));
    if (!res.nextCursor) return ids;
    const decoded = decodeCursor(res.nextCursor);
    if (!decoded.ok) throw new Error(decoded.error);
    cursor = decoded.value;
  }
  throw new Error("cursor walk did not end");
}

beforeEach(async () => {
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values([
    { id: "ana", name: "Ana", email: "ana@example.com", image: "https://img/ana.png", createdAt: now, updatedAt: now },
    { id: "ben", name: "Ben", email: "ben@example.com", createdAt: now, updatedAt: now },
  ]);
});

describe("listForumThreads", () => {
  it("orders by last activity, breaking same-second ties by id, and walks every row once", async () => {
    // Threads 1–3 share one activity second; 4 is newest; 5 oldest.
    await thread(1, { at: 1_700_000_100 });
    await thread(2, { at: 1_700_000_100 });
    await thread(3, { at: 1_700_000_100 });
    await thread(4, { at: 1_700_000_200 });
    await thread(5, { at: 1_700_000_000 });
    const expected = [uuid(4), uuid(3), uuid(2), uuid(1), uuid(5)];

    expect((await listForumThreads(db, { limit: 10, cursor: null })).threads.map((t) => t.id)).toEqual(expected);
    for (const limit of [1, 2, 3, 4, 5]) expect(await walk("active", limit)).toEqual(expected);
  });

  it("orders 'new' by creation, independent of activity", async () => {
    await thread(1, { created: 1_000, at: 9_000 });
    await thread(2, { created: 2_000, at: 3_000 });
    await thread(3, { created: 3_000, at: 4_000 });
    expect(await walk("new", 1)).toEqual([uuid(3), uuid(2), uuid(1)]);
    expect(await walk("active", 1)).toEqual([uuid(1), uuid(3), uuid(2)]);
  });

  it("orders 'top' by likes, walking through ties without loss", async () => {
    await thread(1, { likes: 5 });
    await thread(2, { likes: 5 });
    await thread(3, { likes: 9 });
    await thread(4, { likes: 0 });
    await thread(5, { likes: 5 });
    const expected = [uuid(3), uuid(5), uuid(2), uuid(1), uuid(4)];
    for (const limit of [1, 2, 10]) expect(await walk("top", limit)).toEqual(expected);
  });

  it("narrows to one board", async () => {
    await thread(1, { category: "policy" });
    await thread(2, { category: "general" });
    await thread(3, { category: "policy" });
    const res = await listForumThreads(db, { limit: 10, cursor: null, category: "policy" });
    expect(res.category).toBe("policy");
    expect(res.threads.map((t) => t.id)).toEqual([uuid(3), uuid(1)]);
    expect(await walk("active", 1, "policy")).toEqual([uuid(3), uuid(1)]);
  });

  it("counts live replies only and shows zero for none", async () => {
    await thread(1);
    await thread(2);
    await reply(1, 1);
    await reply(1, 2);
    await reply(1, 3, true);
    const { threads } = await listForumThreads(db, { limit: 10, cursor: null });
    const byId = Object.fromEntries(threads.map((t) => [t.id, t.replyCount]));
    expect(byId).toEqual({ [uuid(1)]: 2, [uuid(2)]: 0 });
  });

  it("hides soft-deleted threads", async () => {
    await thread(1);
    await thread(2);
    await db.update(schema.forumThreads).set({ deletedAt: new Date() }).where(eq(schema.forumThreads.id, uuid(1)));
    expect((await listForumThreads(db, { limit: 10, cursor: null })).threads.map((t) => t.id)).toEqual([uuid(2)]);
    expect(await getForumThread(db, { threadId: uuid(1) })).toBeNull();
  });

  it("shapes summaries: author, excerpt, unknown board shown as general, wire times in seconds", async () => {
    const long = `${"word ".repeat(80)}tail`;
    await thread(1, { body: long, category: "retired-board", at: 1_700_000_123 });
    await thread(2, { body: `  many\n\n spaces\there  `, author: "ben" });
    await thread(3, { body: "x".repeat(400) });
    const { threads, viewer, nextCursor } = await listForumThreads(db, { limit: 10, cursor: null });
    expect(viewer).toBeNull();
    expect(nextCursor).toBeNull();
    const t1 = threads.find((t) => t.id === uuid(1))!;
    expect(t1.category).toBe("general");
    expect(t1.author).toEqual({ id: "ana", name: "Ana", imageUrl: "https://img/ana.png" });
    expect(t1.lastActivityAt).toBe(1_700_000_123);
    expect(t1.excerpt.endsWith("…")).toBe(true);
    expect(t1.excerpt.length).toBeLessThanOrEqual(281);
    // Cut on a word: no half-"word" before the ellipsis.
    expect(t1.excerpt.slice(0, -1).endsWith("word")).toBe(true);
    const t2 = threads.find((t) => t.id === uuid(2))!;
    expect(t2.excerpt).toBe("many spaces here");
    expect(t2.author).toEqual({ id: "ben", name: "Ben", imageUrl: null });
    // No whitespace in the window: cut exactly at the limit.
    expect(threads.find((t) => t.id === uuid(3))!.excerpt).toBe(`${"x".repeat(280)}…`);
  });

  it("names the viewer, and marks what they liked", async () => {
    await thread(1);
    await thread(2);
    await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ben" });
    const res = await listForumThreads(db, { limit: 10, cursor: null, viewerId: "ben" });
    expect(res.viewer).toEqual({ id: "ben", name: "Ben", imageUrl: null });
    expect(Object.fromEntries(res.threads.map((t) => [t.id, t.viewerHasLiked]))).toEqual({ [uuid(1)]: true, [uuid(2)]: false });
    expect((await listForumThreads(db, { limit: 10, cursor: null, viewerId: "nobody" })).viewer).toBeNull();
  });
});

describe("insertForumThread / getForumThread", () => {
  it("writes a thread and reads it back whole, with matching created and activity times", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const created = await insertForumThread(db, { id, title: "Is condo good?", body: "Discuss.", authorId: "ana", category: "policy" });
    expect(created).toMatchObject({ id, title: "Is condo good?", body: "Discuss.", category: "policy", replyCount: 0, likeCount: 0, viewerHasLiked: false });
    expect(created.createdAt).toBe(created.lastActivityAt);
    expect(await getForumThread(db, { threadId: id })).toMatchObject({ id, body: "Discuss." });
  });

  it("defaults the board to general", async () => {
    const id = "9c858901-8a57-4791-81fe-4c455b099bc9";
    expect((await insertForumThread(db, { id, title: "t", body: "b", authorId: "ana" })).category).toBe("general");
  });

  it("returns null for a malformed or unknown id", async () => {
    expect(await getForumThread(db, { threadId: "not-a-uuid" })).toBeNull();
    expect(await getForumThread(db, { threadId: uuid(99) })).toBeNull();
  });
});

describe("touchThreadActivity", () => {
  it("moves a replied-to thread to the top of the active feed", async () => {
    await thread(1, { at: 1_000 });
    await thread(2, { at: 2_000 });
    await touchThreadActivity(db, uuid(1));
    expect(await walk("active", 10)).toEqual([uuid(1), uuid(2)]);
  });

  it("does not revive a deleted thread", async () => {
    await thread(1, { at: 1_000 });
    await db.update(schema.forumThreads).set({ deletedAt: new Date() }).where(eq(schema.forumThreads.id, uuid(1)));
    await touchThreadActivity(db, uuid(1));
    const [row] = await db.select().from(schema.forumThreads);
    expect(row.lastActivityAt.getTime()).toBe(1_000_000);
  });
});

describe("toggleForumThreadLike", () => {
  it("likes, unlikes, and keeps like_count equal to the rows, without bumping activity", async () => {
    await thread(1, { at: 1_000 });
    expect(await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ana" })).toEqual({ ok: true, value: { liked: true, likeCount: 1 } });
    expect(await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ben" })).toEqual({ ok: true, value: { liked: true, likeCount: 2 } });
    expect(await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ana" })).toEqual({ ok: true, value: { liked: false, likeCount: 1 } });
    const [row] = await db.select().from(schema.forumThreads);
    expect(row.likeCount).toBe(1);
    expect(row.lastActivityAt.getTime()).toBe(1_000_000);
  });

  it("repairs a drifted like_count on the next toggle", async () => {
    await thread(1, { likes: 40 });
    expect(await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ana" })).toEqual({ ok: true, value: { liked: true, likeCount: 1 } });
  });

  it("refuses a malformed id and a deleted thread", async () => {
    expect(await toggleForumThreadLike(db, { threadId: "x", userId: "ana" })).toEqual({ ok: false, error: "That is not a thread." });
    await thread(1);
    await db.update(schema.forumThreads).set({ deletedAt: new Date() });
    expect(await toggleForumThreadLike(db, { threadId: uuid(1), userId: "ana" })).toEqual({ ok: false, error: "That thread no longer exists." });
  });
});
