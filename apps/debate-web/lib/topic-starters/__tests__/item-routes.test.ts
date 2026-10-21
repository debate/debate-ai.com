/**
 * @fileoverview The admin panel tree's item routes — rename and move through
 * `PATCH /api/admin/topic-starters/[id]`, and Copy / Paste through
 * `POST /api/admin/topic-starters/[id]/copy` — against a real in-memory
 * SQLite database built from the drizzle schema.
 */
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../database/schema";
import { topicStarterItems } from "../../database/schema";

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

const { PATCH } = await import("@/app/api/admin/topic-starters/[id]/route");
const { POST: COPY } = await import("@/app/api/admin/topic-starters/[id]/copy/route");

type DB = ReturnType<typeof drizzle<typeof schema>>;
let db: DB;

beforeAll(async () => {
  const ddl = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema));
  const client = createClient({ url: ":memory:" });
  for (const statement of ddl) await client.execute(statement);
  db = drizzle(client, { schema });
  access.db = db;
});

beforeEach(async () => {
  await db.delete(topicStarterItems);
  access.staff = true;
  access.email = "admin@example.com";
  await db.insert(topicStarterItems).values([
    { id: 1, title: "2026 Topic", isFolder: true },
    { id: 2, title: "Warming 1AC", parentId: 1, content: "a", format: "cmir", year: 2026, published: false },
    { id: 3, title: "Neg", parentId: 1, isFolder: true },
    { id: 4, title: "Cap K", parentId: 3, content: "c" },
    { id: 5, title: "Impacts", isFolder: true },
  ]);
});

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const json = (body: unknown) =>
  new NextRequest("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const rows = () => db.select().from(topicStarterItems);

describe("PATCH /api/admin/topic-starters/[id]", () => {
  it("renames without moving when only a title is sent", async () => {
    const res = await PATCH(json({ title: "  Warming Aff  " }), ctx(2));
    expect(res.status).toBe(200);
    const [row] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, 2));
    expect(row).toMatchObject({ title: "Warming Aff", parentId: 1 });
  });

  it("refuses an empty name", async () => {
    const res = await PATCH(json({ title: "   " }), ctx(2));
    expect(res.status).toBe(400);
  });

  it("still moves when parentId is sent", async () => {
    await PATCH(json({ parentId: 5 }), ctx(2));
    const [row] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, 2));
    expect(row.parentId).toBe(5);
  });
});

describe("POST /api/admin/topic-starters/[id]/copy", () => {
  it("pastes a file into another folder with its content and flags", async () => {
    const res = await COPY(json({ parentId: 5 }), ctx(2));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: number };
    const [copy] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id));
    expect(copy).toMatchObject({ title: "Warming 1AC", parentId: 5, content: "a", format: "cmir", year: 2026, published: false, isFolder: false });
  });

  it("marks a copy pasted beside its original", async () => {
    const res = await COPY(json({ parentId: 1 }), ctx(2));
    const { id } = (await res.json()) as { id: number };
    const [copy] = await db.select().from(topicStarterItems).where(eq(topicStarterItems.id, id));
    expect(copy.title).toBe("Warming 1AC (copy)");
  });

  it("copies a folder with everything in it", async () => {
    const res = await COPY(json({ parentId: null }), ctx(1));
    const { id } = (await res.json()) as { id: number };
    const all = await rows();
    expect(all).toHaveLength(9);
    const neg = all.find((row) => row.parentId === id && row.title === "Neg")!;
    expect(all.find((row) => row.parentId === neg.id)).toMatchObject({ title: "Cap K", content: "c" });
    // The originals are untouched.
    expect(all.find((row) => row.id === 4)!.parentId).toBe(3);
  });

  it("refuses to paste a folder into itself", async () => {
    const res = await COPY(json({ parentId: 3 }), ctx(1));
    expect(res.status).toBe(400);
    expect(await rows()).toHaveLength(5);
  });

  it("is staff-only", async () => {
    access.staff = false;
    const res = await COPY(json({ parentId: 5 }), ctx(2));
    expect(res.status).toBe(403);
  });
});
