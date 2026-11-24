/**
 * @fileoverview `/api/feedback` and `/api/admin/feedback` against a real
 * in-memory SQLite database: anyone can send feedback, once an hour per
 * address, account or email, and only admins read or delete it.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";

const db = drizzle(createClient({ url: ":memory:" }), { schema });
let signedInAs: string | null = null;
let isAdmin = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: null }) }));

const route = await import("@/app/api/feedback/route");
const admin = await import("@/app/api/admin/feedback/route");
const { feedbackWaitSeconds, ensureFeedbackTable } = await import("@/lib/feedback/store");

const send = (body: unknown, ip = "203.0.113.1") =>
  route.POST(
    new Request("https://debate-ai.com/api/feedback", {
      method: "POST",
      headers: { "cf-connecting-ip": ip, "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
  );

describe("/api/feedback", () => {
  beforeEach(async () => {
    signedInAs = null;
    isAdmin = false;
    // The admin list joins the account name from `user`.
    await db.run(sql`CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL)`);
    await db.run(sql`INSERT OR IGNORE INTO "user" (id, name) VALUES ('u1', 'Sam')`);
    await ensureFeedbackTable(db as never);
    await db.run(sql`DELETE FROM site_feedback`);
  });

  it("stores feedback of any length from a signed-out visitor", async () => {
    const long = "word ".repeat(20_000).trim();
    const res = await send({ email: " Alex@Example.com ", message: long, page: "/settings" });
    expect(res.status).toBe(200);

    isAdmin = true;
    const { feedback } = await (await admin.GET()).json();
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ email: "alex@example.com", message: long, page: "/settings", userId: null });
  });

  it("rejects a bad email or an empty message", async () => {
    expect((await send({ email: "nope", message: "hi" })).status).toBe(400);
    expect((await send({ email: "a@b.co", message: "   " })).status).toBe(400);
    expect((await send(null)).status).toBe(400);
  });

  it("allows one submission an hour per address, email or account", async () => {
    expect((await send({ email: "a@b.co", message: "first" })).status).toBe(200);

    // Same address, different email.
    const again = await send({ email: "other@b.co", message: "second" });
    expect(again.status).toBe(429);
    expect(Number(again.headers.get("retry-after"))).toBeGreaterThan(3500);
    expect((await again.json()).error).toMatch(/in 1 hour/);

    // Same email, different address.
    expect((await send({ email: "a@b.co", message: "third" }, "198.51.100.7")).status).toBe(429);

    // Same account, different address and email.
    signedInAs = "u1";
    expect((await send({ email: "c@d.co", message: "x" }, "198.51.100.8")).status).toBe(200);
    expect((await send({ email: "e@f.co", message: "y" }, "198.51.100.9")).status).toBe(429);
    isAdmin = true;
    const { feedback } = await (await admin.GET()).json();
    expect(feedback[0]).toMatchObject({ email: "c@d.co", userId: "u1", userName: "Sam" });

    // Someone else entirely is unaffected.
    signedInAs = null;
    expect((await send({ email: "g@h.co", message: "z" }, "198.51.100.10")).status).toBe(200);
  });

  it("opens up again once the hour has passed", async () => {
    const sender = { ipHash: "h", userId: null, userAgent: null };
    const now = 1_800_000_000;
    await db.run(sql`INSERT INTO site_feedback (email, message, ip_hash, created_at) VALUES ('a@b.co', 'm', 'h', ${now})`);
    expect(await feedbackWaitSeconds(db as never, "x@y.co", sender, now + 60)).toBe(3540);
    expect(await feedbackWaitSeconds(db as never, "x@y.co", sender, now + 3600)).toBe(0);
  });

  it("lets only admins read and delete feedback", async () => {
    await send({ email: "a@b.co", message: "hello" });
    expect((await admin.GET()).status).toBe(403);

    isAdmin = true;
    const { feedback } = await (await admin.GET()).json();
    const del = (id: string) => admin.DELETE(new Request(`https://debate-ai.com/api/admin/feedback?id=${id}`, { method: "DELETE" }));
    expect((await del("abc")).status).toBe(400);
    expect((await del(String(feedback[0].id))).status).toBe(200);
    expect((await (await admin.GET()).json()).feedback).toEqual([]);
  });
});
