/**
 * @fileoverview The Topic Starters change queue end to end: a reader's edit
 * through `POST /api/topic-starters/changes` (queued), a moderator's (applied),
 * and the admin review route — against a real in-memory SQLite database built
 * from the drizzle schema. `topic_starter_changes` is left out of that schema
 * dump so the lib's create-on-first-use is what makes it.
 */
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { notifications, topicStarterChanges, topicStarterItems, user } from "../../database/schema";

const access = vi.hoisted(() => ({ email: null as string | null, staff: false, db: null as unknown }));

vi.mock("@/lib/auth/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/admin")>();
  return {
    ...actual,
    getAdminEmails: () => ["admin@example.com"],
    getStaffAccess: async () => ({
      isAdmin: access.staff,
      email: access.email,
      role: access.staff ? "admin" : null,
      isModerator: false,
      canEditContent: access.staff,
    }),
  };
});
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (access.email ? { user: { id: `u-${access.email}`, email: access.email, name: "x" } } : null),
}));
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/database/context")>()),
  getDBFromContext: async () => access.db,
}));

const { POST: proposeChange } = await import("@/app/api/topic-starters/changes/route");
const { GET: listChanges } = await import("@/app/api/admin/topic-starters/changes/route");
const { POST: reviewChange } = await import("@/app/api/admin/topic-starters/changes/[id]/route");

type DB = ReturnType<typeof drizzle<typeof schema>>;
let db: DB;

beforeAll(async () => {
  const ddl = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  const client = createClient({ url: ":memory:" });
  for (const statement of ddl) {
    if (statement.includes("`topic_starter_changes`")) continue;
    await client.execute(statement);
  }
  db = drizzle(client, { schema });
  access.db = db;
});

beforeEach(async () => {
  await db.delete(topicStarterItems);
  await db.delete(notifications);
  await db.delete(user);
  try {
    await db.delete(topicStarterChanges);
  } catch {
    // Not created yet — the first queued change makes it.
  }
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function seed() {
  await db.insert(user).values({ id: "admin-1", name: "Admin", email: "admin@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(topicStarterItems).values([
    { id: 1, title: "2026 Topic", isFolder: true },
    { id: 2, title: "Warming 1AC", parentId: 1, content: "a" },
    { id: 3, title: "Elections DA", parentId: 1, content: "b" },
    { id: 4, title: "Cap K", parentId: 1, content: "c" },
    { id: 5, title: "Impacts", isFolder: true },
  ]);
}

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

async function item(id: number) {
  const [row] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id));
  return row;
}

describe("Topic Starters change queue", () => {
  it("refuses a signed-out reader", async () => {
    access.email = null;
    const res = await proposeChange(post("/api/topic-starters/changes", { kind: "delete", itemId: 2 }));
    expect(res.status).toBe(401);
  });

  it("queues a reader's move, notifies the moderators, and applies it on approval", async () => {
    await seed();
    access.email = "reader@example.com";
    access.staff = false;
    const res = await proposeChange(post("/api/topic-starters/changes", { kind: "move", itemId: 2, parentId: 5 }));
    expect(res.status).toBe(202);
    const { id } = (await res.json()) as { id: number };
    expect((await item(2))!.parentId).toBe(1);
    const [note] = await db.select().from(notifications);
    expect(note).toMatchObject({ userId: "admin-1", type: "topic_starter_change", link: "/admin#topic-starters" });
    expect(note!.body).toContain("Move Warming 1AC to Impacts");

    // Only staff see or review the queue.
    expect((await listChanges(new NextRequest("http://localhost/api/admin/topic-starters/changes"))).status).toBe(403);
    expect((await reviewChange(post("/x", { decision: "approve" }), params(id))).status).toBe(403);

    access.email = "admin@example.com";
    access.staff = true;
    const list = (await (await listChanges(new NextRequest("http://localhost/api/admin/topic-starters/changes"))).json()) as {
      changes: Array<{ id: number; summary: string; submittedBy: string }>;
    };
    expect(list.changes).toEqual([expect.objectContaining({ id, summary: "Move Warming 1AC to Impacts", submittedBy: "reader@example.com" })]);

    const approved = await reviewChange(post("/x", { decision: "approve" }), params(id));
    expect(approved.status).toBe(200);
    expect((await item(2))!.parentId).toBe(5);
    expect((await reviewChange(post("/x", { decision: "approve" }), params(id))).status).toBe(409);
    const pending = (await (await listChanges(new NextRequest("http://localhost/api/admin/topic-starters/changes"))).json()) as { changes: unknown[] };
    expect(pending.changes).toEqual([]);
  });

  it("queues a reader's file submission and publishes it on approval; a rejection changes nothing", async () => {
    await seed();
    access.email = "reader@example.com";
    access.staff = false;
    const submitted = await proposeChange(
      post("/api/topic-starters/changes", { kind: "submit", title: "Spending DA", content: "H4s", format: "cmir", parentId: 5 }),
    );
    const { id: submitId } = (await submitted.json()) as { id: number };
    const renamed = await proposeChange(post("/api/topic-starters/changes", { kind: "rename", itemId: 4, title: "Capitalism K" }));
    const { id: renameId } = (await renamed.json()) as { id: number };

    access.email = "admin@example.com";
    access.staff = true;
    const list = (await (await listChanges(new NextRequest("http://localhost/api/admin/topic-starters/changes"))).json()) as {
      changes: Array<{ id: number; change: { content?: string } }>;
    };
    // The queue never ships the submitted file itself.
    expect(list.changes.find((c) => c.id === submitId)!.change.content).toBe("");

    await reviewChange(post("/x", { decision: "approve" }), params(submitId));
    const [added] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.title, "Spending DA"));
    expect(added).toMatchObject({ parentId: 5, content: "H4s", format: "cmir", published: true, isFolder: false });

    await reviewChange(post("/x", { decision: "reject" }), params(renameId));
    expect((await item(4))!.title).toBe("Cap K");
  });

  it("records why an approval no longer applies and leaves it pending", async () => {
    await seed();
    access.email = "reader@example.com";
    access.staff = false;
    const res = await proposeChange(post("/api/topic-starters/changes", { kind: "rename", itemId: 3, title: "Midterms DA" }));
    const { id } = (await res.json()) as { id: number };
    await db.delete(topicStarterItems).where(eq(topicStarterItems.id, 3));

    access.email = "admin@example.com";
    access.staff = true;
    const failed = await reviewChange(post("/x", { decision: "approve" }), params(id));
    expect(failed.status).toBe(404);
    const [record] = await db.select().from(topicStarterChanges).where(eq(topicStarterChanges.id, id));
    expect(record).toMatchObject({ status: "pending", error: "That Topic Starter item no longer exists." });
  });

  it("applies a moderator's edits at once: a folder delete cascades, a folder can't move into itself", async () => {
    await seed();
    access.email = "admin@example.com";
    access.staff = true;
    const moved = await proposeChange(post("/api/topic-starters/changes", { kind: "move", itemId: 1, parentId: 5 }));
    expect(await moved.json()).toEqual({ status: "applied" });
    expect((await item(1))!.parentId).toBe(5);

    const loop = await proposeChange(post("/api/topic-starters/changes", { kind: "move", itemId: 5, parentId: 1 }));
    expect(loop.status).toBe(400);
    expect(await loop.json()).toEqual({ error: "A folder cannot be moved into its own subtree." });

    await proposeChange(post("/api/topic-starters/changes", { kind: "delete", itemId: 5 }));
    expect(await db.select().from(topicStarterItems)).toEqual([]);
  });

  it("reorganizes by argument into Aff/Neg folders and drops the folders it emptied", async () => {
    await seed();
    access.email = "admin@example.com";
    access.staff = true;
    const res = await proposeChange(
      post("/api/topic-starters/changes", {
        kind: "reorganize",
        assignments: [
          { itemId: 2, side: "aff", type: "case" },
          { itemId: 3, side: "neg", type: "da" },
          { itemId: 4, side: "neg", type: "k" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(topicStarterItems);
    const byTitle = (title: string, parentId: number | null = null) => rows.find((r) => r.title === title && r.parentId === parentId);
    const aff = byTitle("Aff")!;
    const neg = byTitle("Neg")!;
    expect((await item(2))!.parentId).toBe(byTitle("Case", aff.id)!.id);
    expect((await item(3))!.parentId).toBe(byTitle("DA", neg.id)!.id);
    expect((await item(4))!.parentId).toBe(byTitle("K", neg.id)!.id);
    // "2026 Topic" was emptied by the moves; "Impacts" was already empty and is
    // left alone.
    expect(await item(1)).toBeUndefined();
    expect(await item(5)).toBeDefined();
  });
});
