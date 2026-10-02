/**
 * @fileoverview The comment queries, run against a real SQLite database.
 *
 * Everything else in `lib/comments` is pure and tested as pure. This is the
 * half that cannot be: the thread read is one query with a `LEFT JOIN`, a
 * `GROUP BY`, a `count()` and a conditional `max()` folded together, and the
 * ways that can be wrong — a fan-out that multiplies the like count, a `desc`
 * that the cap turns into "oldest 500", a timestamp column that comes back as
 * a `Date` rather than the number the wire format promises — only show up
 * against a database that answers.
 *
 * So this drives the same drizzle the app uses, over a throwaway libSQL file
 * built from the app schema.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  countCommentsForResource,
  deleteOwnComment,
  getCommentThread,
  insertComment,
  resolveReplyParent,
  toggleCommentLike,
} from "@/lib/comments/queries";
import { commentLikes, comments } from "@/lib/database/schema";
import { applySchema } from "@/lib/database/__tests__/schema-sql";
import { parseParentId } from "@debate/webview/lib/comments/validation";

let directory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle>;

const ROOT = "0f8fad5b-d9cb-469f-a165-70867728950e";
const REPLY = "1f8fad5b-d9cb-469f-a165-70867728950e";
const GRANDCHILD = "2f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER_VIDEO = "3f8fad5b-d9cb-469f-a165-70867728950e";

/** Inserts an author row; comments cannot be written without one. */
async function addUser(id: string, name: string, image: string | null = null): Promise<void> {
  await client.execute({
    sql: "INSERT INTO user (id, name, email, image, created_at, updated_at) VALUES (?, ?, ?, ?, unixepoch(), unixepoch())",
    args: [id, name, `${id}@example.test`, image],
  });
}

interface CommentSeed {
  parentId?: string | null;
  resourceId?: string;
  authorId?: string;
  body?: string;
  deletedAt?: number | null;
  /** Seconds to add to `created_at`, so an ordering assertion is about order. */
  at?: number;
}

/** Writes a comment row directly, so a test can set up a shape in one line. */
async function addComment(id: string, seed: CommentSeed = {}): Promise<void> {
  await client.execute({
    sql: `INSERT INTO comments (id, resource_type, resource_id, parent_id, author_id, body, deleted_at, created_at, updated_at)
          VALUES (?, 'video', ?, ?, ?, ?, ?, unixepoch() + ?, unixepoch())`,
    args: [
      id,
      seed.resourceId ?? "v1",
      seed.parentId ?? null,
      seed.authorId ?? "ana",
      seed.body ?? `body ${id}`,
      seed.deletedAt ?? null,
      seed.at ?? 0,
    ],
  });
}

/** The id of the nth row written by {@link seedBusyThread}. */
const busyId = (index: number) => `busy-${String(index).padStart(4, "0")}`;

/** Writes `count` comments on one resource, oldest first. */
async function seedBusyThread(count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    await addComment(busyId(index), { resourceId: "busy", at: index });
  }
}

async function like(commentId: string, userId: string): Promise<void> {
  await db.insert(commentLikes).values({ commentId, userId });
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "comment-queries-"));
  client = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  db = drizzle(client, { schema: {} });

  await applySchema(client);
});

afterAll(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(commentLikes);
  await db.delete(comments);
  await client.execute("DELETE FROM user");
  await addUser("ana", "Ana Ruiz", "https://cdn.test/ana.png");
  await addUser("ben", "Ben Okafor");
});

describe("getCommentThread", () => {
  it("returns a reply nested under the comment it answers, and a reply-to-reply under that", async () => {
    await addComment(ROOT);
    await addComment(REPLY, { parentId: ROOT });
    await addComment(GRANDCHILD, { parentId: REPLY });

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0].id).toBe(ROOT);
    expect(thread.comments[0].replies[0].id).toBe(REPLY);
    expect(thread.comments[0].replies[0].replies[0].id).toBe(GRANDCHILD);
    expect(thread.totalCount).toBe(3);
  });

  it("orders a thread oldest first, the way a conversation is read", async () => {
    // Written newest-first, on purpose: the read — not the insert order — is
    // what has to put them back in order.
    await addComment(GRANDCHILD, { at: 30 });
    await addComment(REPLY, { at: 20 });
    await addComment(ROOT, { at: 10 });

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    expect(thread.comments.map((comment) => comment.id)).toEqual([ROOT, REPLY, GRANDCHILD]);
  });

  it("keeps another resource's thread out of this one", async () => {
    await addComment(ROOT, { resourceId: "v1" });
    await addComment(OTHER_VIDEO, { resourceId: "v2" });

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    expect(thread.comments.map((comment) => comment.id)).toEqual([ROOT]);
  });

  it("keeps another kind's thread out of this one, even on the same id", async () => {
    await addComment(ROOT, { resourceId: "v1" });
    await client.execute({
      sql: "INSERT INTO comments (id, resource_type, resource_id, author_id, body) VALUES (?, 'lecture', 'v1', 'ana', 'a lecture note')",
      args: [OTHER_VIDEO],
    });

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    expect(thread.comments.map((comment) => comment.id)).toEqual([ROOT]);
  });

  it("counts likes without multiplying the comment they are on", async () => {
    await addComment(ROOT);
    await addComment(REPLY, { parentId: ROOT });
    await like(ROOT, "ana");
    await like(ROOT, "ben");

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    // The join fans out by like count; the count must still be 2, not 4.
    expect(thread.comments[0].likeCount).toBe(2);
    expect(thread.comments[0].replies[0].likeCount).toBe(0);
  });

  it("fills in one viewer's hearts and not another's", async () => {
    await addComment(ROOT);
    await like(ROOT, "ana");

    const asAna = await getCommentThread(db, { resourceType: "video", resourceId: "v1", viewerId: "ana" });
    const asBen = await getCommentThread(db, { resourceType: "video", resourceId: "v1", viewerId: "ben" });

    expect(asAna.comments[0].viewerHasLiked).toBe(true);
    expect(asBen.comments[0].viewerHasLiked).toBe(false);
  });

  it("treats a signed-out read as a read that has liked nothing", async () => {
    await addComment(ROOT);
    await like(ROOT, "ana");

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    expect(thread.comments[0].likeCount).toBe(1);
    expect(thread.comments[0].viewerHasLiked).toBe(false);
    expect(thread.viewer).toBeNull();
  });

  it("carries the viewer's public fields, and never their email", async () => {
    await getCommentThread(db, { resourceType: "video", resourceId: "v1", viewerId: "ana" }).then(
      (thread) => {
        expect(thread.viewer).toEqual({
          id: "ana",
          name: "Ana Ruiz",
          imageUrl: "https://cdn.test/ana.png",
        });
        expect(JSON.stringify(thread)).not.toContain("ana@example.test");
      },
    );
  });

  it("does not ship a deleted comment's text, but keeps the row and its replies", async () => {
    await addComment(ROOT, { deletedAt: 1_700_000_500 });
    await addComment(REPLY, { parentId: ROOT, body: "the sub-conversation" });
    await like(ROOT, "ana");

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    const [deleted] = thread.comments;

    expect(deleted.body).toBe("");
    expect(deleted.deletedAt).toBeGreaterThan(0);
    expect(JSON.stringify(thread)).not.toContain(`body ${ROOT}`);
    // The row stays, so the thread reads as one that had a post in it, and the
    // reply that answered it is still there.
    expect(thread.totalCount).toBe(2);
    expect(deleted.replies[0].body).toBe("the sub-conversation");
    // A deleted comment cannot be liked.
    expect(deleted.likeCount).toBe(0);
    expect(deleted.viewerHasLiked).toBe(false);
  });

  it("reports timestamps as seconds, the shape the UI formats", async () => {
    await addComment(ROOT);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });

    // drizzle reads an integer-timestamp column as a Date; the wire format is a
    // number, and `formatRelativeTime` does arithmetic on it.
    expect(typeof thread.comments[0].createdAt).toBe("number");
    expect(thread.comments[0].createdAt).toBeGreaterThan(1_600_000_000);
  });

  it("says so when a thread is longer than one response can carry", async () => {
    await seedBusyThread(505);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "busy" });

    expect(thread.truncated).toBe(true);
    expect(thread.comments).toHaveLength(500);
  });

  it("keeps the newest comments when it truncates, not the oldest", async () => {
    // A capped read that cut the *newest* would leave a reader looking at
    // yesterday's argument and calling the page dead.
    await seedBusyThread(505);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "busy" });

    expect(thread.comments.some((comment) => comment.id === busyId(504))).toBe(true);
    expect(thread.comments.some((comment) => comment.id === busyId(0))).toBe(false);
  });

  it("does not claim a short thread was truncated", async () => {
    await addComment(ROOT);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    expect(thread.truncated).toBe(false);
  });
});

describe("insertComment", () => {
  it("returns the stored comment in the wire shape, ready to drop into the tree", async () => {
    const stored = await insertComment(db, {
      resourceType: "video",
      resourceId: "v1",
      parentId: null,
      authorId: "ana",
      body: "good read",
      id: ROOT,
    });

    expect(stored).toMatchObject({
      id: ROOT,
      resourceType: "video",
      resourceId: "v1",
      parentId: null,
      body: "good read",
      likeCount: 0,
      viewerHasLiked: false,
      deletedAt: null,
      replies: [],
    });
    expect(stored.author).toEqual({ id: "ana", name: "Ana Ruiz", imageUrl: "https://cdn.test/ana.png" });
    expect(typeof stored.createdAt).toBe("number");
  });

  it("stores a reply under its parent, so the next read nests it", async () => {
    await insertComment(db, {
      resourceType: "video",
      resourceId: "v1",
      parentId: null,
      authorId: "ana",
      body: "root",
      id: ROOT,
    });
    await insertComment(db, {
      resourceType: "video",
      resourceId: "v1",
      parentId: ROOT,
      authorId: "ben",
      body: "a reply",
      id: REPLY,
    });

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    expect(thread.comments[0].replies[0].id).toBe(REPLY);
  });

  it("refuses a comment with no author behind it", async () => {
    // The route checks for a session, so this is the schema's own backstop:
    // a comment has to name a real account, because its name is shown next to
    // it. `author_id`'s foreign key is what enforces that.
    await expect(
      insertComment(db, {
        resourceType: "video",
        resourceId: "v1",
        parentId: null,
        authorId: "nobody",
        body: "orphan author",
        id: OTHER_VIDEO,
      }),
    ).rejects.toThrow();

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    expect(thread.comments).toEqual([]);
  });
});

describe("resolveReplyParent", () => {
  it("accepts a top-level comment with no parent", async () => {
    const result = await resolveReplyParent(db, parseParentId(null), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result).toEqual({ ok: true, value: { parentId: null } });
  });

  it("accepts a parent on this resource and reports how deep the reply lands", async () => {
    await addComment(ROOT);
    await addComment(REPLY, { parentId: ROOT });

    const result = await resolveReplyParent(db, parseParentId(REPLY), {
      resourceType: "video",
      resourceId: "v1",
    });

    // Counting a top-level comment as level 1, a reply to a reply would sit
    // at level 3 — one below the comment it answers.
    expect(result.ok && result.value).toEqual({ parentId: REPLY, depth: 3 });
  });

  it("counts a reply-to-reply as deeper than a reply", async () => {
    await addComment(ROOT);
    await addComment(REPLY, { parentId: ROOT });
    await addComment(GRANDCHILD, { parentId: REPLY });

    const result = await resolveReplyParent(db, parseParentId(GRANDCHILD), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok && result.value).toEqual({ parentId: GRANDCHILD, depth: 4 });
  });

  it("refuses a parent on a different resource", async () => {
    // Otherwise a caller can graft a reply onto another video's thread, and it
    // renders under a video the text has nothing to do with.
    await addComment(ROOT, { resourceId: "v2" });

    const result = await resolveReplyParent(db, parseParentId(ROOT), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/not a comment on this page/);
  });

  it("refuses a parent on a different kind of resource", async () => {
    await client.execute({
      sql: "INSERT INTO comments (id, resource_type, resource_id, author_id, body) VALUES (?, 'lecture', 'v1', 'ana', 'note')",
      args: [ROOT],
    });

    const result = await resolveReplyParent(db, parseParentId(ROOT), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok).toBe(false);
  });

  it("refuses a parent that does not exist", async () => {
    const result = await resolveReplyParent(db, parseParentId(ROOT), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/is gone/);
  });

  it("refuses a parent that has been deleted", async () => {
    await addComment(ROOT, { deletedAt: 1_700_000_500 });

    const result = await resolveReplyParent(db, parseParentId(ROOT), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/deleted/);
  });

  it("refuses a reply that would land past the depth ceiling", async () => {
    // A straight chain of UUIDs: `ids[0]` is a top-level comment at level 1,
    // so `ids[k]` sits at level `k + 1`. MAX_REPLY_DEPTH is 8.
    const ids = Array.from(
      { length: 9 },
      (_, index) => `${String(index).padStart(8, "0")}-d9cb-469f-a165-70867728950e`,
    );
    for (let index = 0; index < ids.length; index++) {
      await addComment(ids[index], { parentId: index === 0 ? null : ids[index - 1] });
    }

    // A reply to level 7 lands at level 8 — the deepest there is.
    const lastAllowed = await resolveReplyParent(db, parseParentId(ids[6]), {
      resourceType: "video",
      resourceId: "v1",
    });
    expect(lastAllowed.ok && lastAllowed.value).toEqual({ parentId: ids[6], depth: 8 });

    // A reply to a comment already at level 8 would land at level 9.
    const tooDeep = await resolveReplyParent(db, parseParentId(ids[7]), {
      resourceType: "video",
      resourceId: "v1",
    });
    expect(tooDeep.ok).toBe(false);
    expect(tooDeep.ok === false && tooDeep.error).toMatch(/8 levels deep/);
  });

  it("passes through a parent id that is not even shaped like one", async () => {
    const result = await resolveReplyParent(db, parseParentId("1 OR 1=1"), {
      resourceType: "video",
      resourceId: "v1",
    });

    expect(result.ok).toBe(false);
  });
});

describe("toggleCommentLike", () => {
  it("likes, then unlikes, and reports the count the table holds", async () => {
    await addComment(ROOT);

    const first = await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    expect(first.ok && first.value).toEqual({ liked: true, likeCount: 1 });

    const second = await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    expect(second.ok && second.value).toEqual({ liked: false, likeCount: 0 });
  });

  it("counts several people separately", async () => {
    await addComment(ROOT);

    await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    const second = await toggleCommentLike(db, { commentId: ROOT, userId: "ben" });

    expect(second.ok && second.value).toEqual({ liked: true, likeCount: 2 });
  });

  it("cannot double-count one person's second click", async () => {
    // The composite primary key is the guarantee: a duplicate like row is not
    // possible, so the toggle settles rather than racing.
    await addComment(ROOT);
    await like(ROOT, "ana");

    const result = await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    const remaining = await db.select().from(commentLikes).where(eq(commentLikes.commentId, ROOT));

    expect(result.ok && result.value.likeCount).toBe(0);
    expect(remaining).toHaveLength(0);
  });

  it("refuses a comment that is not there", async () => {
    const result = await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    expect(result.ok).toBe(false);
  });

  it("refuses a comment that has been deleted", async () => {
    await addComment(ROOT, { deletedAt: 1_700_000_500 });

    const result = await toggleCommentLike(db, { commentId: ROOT, userId: "ana" });
    expect(result.ok).toBe(false);
  });
});

describe("deleteOwnComment", () => {
  it("blanks the body and stamps the row, keeping the replies", async () => {
    await addComment(ROOT, { authorId: "ana" });
    await addComment(REPLY, { parentId: ROOT, authorId: "ben" });

    const result = await deleteOwnComment(db, { commentId: ROOT, userId: "ana" });
    expect(result.ok).toBe(true);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    expect(thread.comments[0].body).toBe("");
    expect(thread.comments[0].deletedAt).toBeGreaterThan(0);
    expect(thread.comments[0].replies[0].id).toBe(REPLY);
  });

  it("refuses to delete somebody else's comment", async () => {
    await addComment(ROOT, { authorId: "ana" });

    const result = await deleteOwnComment(db, { commentId: ROOT, userId: "ben" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/your own/);

    const thread = await getCommentThread(db, { resourceType: "video", resourceId: "v1" });
    expect(thread.comments[0].body).toBe(`body ${ROOT}`);
  });

  it("refuses to delete the same comment twice", async () => {
    await addComment(ROOT, { authorId: "ana" });
    await deleteOwnComment(db, { commentId: ROOT, userId: "ana" });

    const result = await deleteOwnComment(db, { commentId: ROOT, userId: "ana" });
    expect(result.ok).toBe(false);
  });
});

describe("countCommentsForResource", () => {
  it("counts a resource's comments and nobody else's", async () => {
    await addComment(ROOT);
    await addComment(REPLY);
    await addComment(OTHER_VIDEO, { resourceId: "v2" });
    await addComment("4f8fad5b-d9cb-469f-a165-70867728950e", { deletedAt: 1_700_000_500 });

    expect(
      await countCommentsForResource(db, { resourceType: "video", resourceId: "v1" }),
    ).toBe(2);
  });
});
