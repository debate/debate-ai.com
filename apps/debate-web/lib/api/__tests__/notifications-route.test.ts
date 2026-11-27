/**
 * @fileoverview `/api/notifications` against a real SQLite database: the feed
 * is per-account, newest first, with an unread count, and PATCH marks one or all
 * of the caller's notifications read without touching anyone else's.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "user-1";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const route = await import("@/app/api/notifications/route");

const req = (init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest("https://debate-ai.com/api/notifications", init);
const patch = (body: unknown) => route.PATCH(req({ method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) }));
const feed = async () => (await route.GET(req())).json();
const readAtOf = async (id: number) =>
  (await db.select().from(schema.notifications).where(eq(schema.notifications.id, id)))[0].readAt;

describe("/api/notifications", () => {
  beforeEach(async () => {
    signedInAs = "user-1";
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["user-1", "user-2"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
    await db.insert(schema.notifications).values([
      { id: 1, userId: "user-1", type: "round-invite", title: "Older", createdAt: new Date(1_000_000) },
      { id: 2, userId: "user-1", type: "round-invite", title: "Newer", createdAt: new Date(2_000_000) },
      { id: 3, userId: "user-1", type: "round-invite", title: "Seen", createdAt: new Date(3_000_000), readAt: new Date(3_500_000) },
      { id: 4, userId: "user-2", type: "round-invite", title: "Someone else's", createdAt: new Date(4_000_000) },
    ]);
  });

  it("requires a session for both verbs", async () => {
    signedInAs = null;
    expect((await route.GET(req())).status).toBe(401);
    expect((await patch({ all: true })).status).toBe(401);
  });

  it("lists only the caller's notifications, newest first, with the unread count", async () => {
    const body = await feed();
    expect(body.notifications.map((n: { title: string }) => n.title)).toEqual(["Seen", "Newer", "Older"]);
    expect(body.unreadCount).toBe(2);
  });

  it("marks one notification read by numeric or string id", async () => {
    expect((await patch({ id: 1 })).status).toBe(200);
    expect(await readAtOf(1)).toBeInstanceOf(Date);
    expect(await readAtOf(2)).toBeNull();

    await patch({ id: "2" });
    expect(await readAtOf(2)).toBeInstanceOf(Date);
    expect((await feed()).unreadCount).toBe(0);
  });

  it("will not mark another account's notification read", async () => {
    await patch({ id: 4 });
    expect(await readAtOf(4)).toBeNull();
  });

  it("marks every unread notification read with { all: true }, only for the caller", async () => {
    const seenAt = await readAtOf(3);
    expect(await (await patch({ all: true })).json()).toEqual({ ok: true });
    expect((await feed()).unreadCount).toBe(0);
    expect(await readAtOf(3)).toEqual(seenAt);
    expect(await readAtOf(4)).toBeNull();
  });

  it("rejects malformed bodies", async () => {
    expect((await patch("{not json")).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ id: true })).status).toBe(400);
    const fractional = await patch({ id: 1.5 });
    expect(fractional.status).toBe(400);
    expect(await fractional.json()).toEqual({ error: "Invalid notification id." });
    expect((await patch({ id: "abc" })).status).toBe(400);
  });

  it("degrades to an empty feed, quietly, when the table is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const missing = () => {
      throw new Error("D1_ERROR: no such table: notifications");
    };
    db = { select: missing, update: missing } as unknown as typeof db;

    expect(await feed()).toEqual({ notifications: [], unreadCount: 0 });
    expect(warn).toHaveBeenCalledWith("Failed to load notifications", expect.anything());
    expect(error).not.toHaveBeenCalled();

    const failed = await patch({ all: true });
    expect(failed.status).toBe(500);
    expect(warn).toHaveBeenCalledWith("Failed to update notifications", expect.anything());
    warn.mockRestore();
    error.mockRestore();
  });

  it("logs other database failures as errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db = { select: () => { throw new Error("boom"); } } as unknown as typeof db;
    expect(await feed()).toEqual({ notifications: [], unreadCount: 0 });
    expect(error).toHaveBeenCalledWith("Failed to load notifications", expect.any(Error));
    error.mockRestore();
  });
});
