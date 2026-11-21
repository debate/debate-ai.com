/**
 * @fileoverview `/api/admin/deletion-requests` against a real SQLite
 * database: admins only, `?status=` filtering, and status changes that
 * validate their body, 404 on an unknown id and notify the requester.
 */

import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let isAdmin = true;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/admin", () => ({
  getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : "mod@example.com" }),
}));

const route = await import("@/app/api/admin/deletion-requests/route");

const get = (query = "") => route.GET(new Request(`http://x/api/admin/deletion-requests${query}`));
const patch = (body: unknown) =>
  route.PATCH(
    new Request("http://x/api/admin/deletion-requests", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("/api/admin/deletion-requests", () => {
  let pendingId: number;
  let doneId: number;

  beforeEach(async () => {
    isAdmin = true;
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values({ id: "user-1", name: "Pat", email: "pat@example.com", createdAt: now, updatedAt: now });
    const rows = await db
      .insert(schema.dataDeletionRequests)
      .values([
        { userId: "user-1", scope: "all", status: "pending", createdAt: new Date("2026-11-01") },
        { userId: "user-1", scope: "part", categories: '["flows"]', status: "done", createdAt: new Date("2026-10-01") },
      ])
      .returning();
    [pendingId, doneId] = rows.map((row) => row.id);
  });

  it("refuses anyone who isn't an admin", async () => {
    isAdmin = false;
    expect((await get()).status).toBe(403);
    expect((await patch({ id: pendingId, status: "done" })).status).toBe(403);
    const [row] = await db.select().from(schema.dataDeletionRequests).where(eq(schema.dataDeletionRequests.id, pendingId));
    expect(row.status).toBe("pending");
  });

  it("lists every request with the requester, and filters by status", async () => {
    const all = await (await get()).json();
    expect(all.requests.map((r: { id: number }) => r.id)).toEqual([pendingId, doneId]);
    expect(all.requests[0]).toMatchObject({ name: "Pat", email: "pat@example.com", scope: "all" });

    const done = await (await get("?status=done")).json();
    expect(done.requests.map((r: { id: number }) => r.id)).toEqual([doneId]);
    expect((await get("?status=deleted")).status).toBe(400);
  });

  it("sets a status and notifies the requester", async () => {
    const res = await patch({ id: pendingId, status: "declined", note: "Need the round link." });
    expect(res.status).toBe(200);
    expect((await res.json()).request).toMatchObject({ id: pendingId, status: "declined" });
    const sent = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, "user-1"));
    expect(sent.map((n) => n.body)).toEqual(["Your request to delete all of your data was declined. Need the round link."]);
  });

  it("refuses a bad body and an unknown id", async () => {
    expect((await patch("{not json")).status).toBe(400);
    const bad = await patch({ id: pendingId, status: "deleted" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors[0]).toMatch(/status must be one of/);
    expect((await patch({ id: 9999, status: "done" })).status).toBe(404);
  });
});
