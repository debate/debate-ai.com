/**
 * @fileoverview `/api/reference-quote-suggestions` and
 * `/api/admin/reference-suggestions` against a real in-memory SQLite database:
 * anyone can suggest card text for a References entry, abuse is capped per
 * sender and per entry, and only staff read, resolve or delete suggestions.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";

const db = drizzle(createClient({ url: ":memory:" }), { schema });
let signedInAs: string | null = null;
let staff = false;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({
  getStaffAccess: async () => ({ canEditContent: staff, isAdmin: staff, email: staff ? "admin@debate-ai.com" : null }),
}));

const route = await import("@/app/api/reference-quote-suggestions/route");
const admin = await import("@/app/api/admin/reference-suggestions/route");
const { ensureSuggestionsTable, suggestionWaitSeconds } = await import("@/lib/reference-suggestions/store");

const PAGE = "/docs/journal/synergy-slayer-critiques/references";
const textFor = (n: number) =>
  `Change comes from power, and power comes from organized people acting together, as in case number ${n}.`;

const suggestion = (overrides: Record<string, unknown> = {}) => ({
  page: PAGE,
  refId: "ref-ackerman-2020",
  title: "Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.”",
  text: textFor(1),
  ...overrides,
});

const send = (body: unknown, ip = "203.0.113.1") =>
  route.POST(
    new Request("https://debate-ai.com/api/reference-quote-suggestions", {
      method: "POST",
      headers: { "cf-connecting-ip": ip, "user-agent": "vitest" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const list = async (status?: string) =>
  (await admin.GET(new Request(`https://debate-ai.com/api/admin/reference-suggestions${status ? `?status=${status}` : ""}`))).json();

const patch = (body: unknown) =>
  admin.PATCH(new Request("https://debate-ai.com/api/admin/reference-suggestions", { method: "PATCH", body: JSON.stringify(body) }));

const del = (id: string) =>
  admin.DELETE(new Request(`https://debate-ai.com/api/admin/reference-suggestions?id=${id}`, { method: "DELETE" }));

describe("/api/reference-quote-suggestions", () => {
  beforeEach(async () => {
    signedInAs = null;
    staff = false;
    await db.run(sql`CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL)`);
    await db.run(sql`INSERT OR IGNORE INTO "user" (id, name) VALUES ('u1', 'Sam')`);
    await ensureSuggestionsTable(db as never);
    await db.run(sql`DELETE FROM reference_text_suggestions`);
  });

  it("stores a suggestion from a signed-out guest, with the address only hashed", async () => {
    const res = await send(suggestion({ name: "Guest", note: "page 4" }));
    expect(res.status).toBe(200);

    staff = true;
    const { suggestions, counts } = await list();
    expect(counts).toEqual({ pending: 1, approved: 0, dismissed: 0 });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      page: PAGE,
      refId: "ref-ackerman-2020",
      text: textFor(1),
      name: "Guest",
      note: "page 4",
      status: "pending",
      userId: null,
    });
    const [row] = (await db.all(sql`SELECT ip_hash, user_agent FROM reference_text_suggestions`)) as { ip_hash: string; user_agent: string }[];
    expect(row!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.ip_hash).not.toContain("203.0.113.1");
  });

  it("records the account of a signed-in sender", async () => {
    signedInAs = "u1";
    expect((await send(suggestion())).status).toBe(200);
    staff = true;
    expect((await list()).suggestions[0]).toMatchObject({ userId: "u1", userName: "Sam" });
  });

  it("rejects bad input with a 400 and stores nothing", async () => {
    expect((await send("not json")).status).toBe(400);
    expect((await send(suggestion({ text: "too short" }))).status).toBe(400);
    expect((await send(suggestion({ page: "/admin" }))).status).toBe(400);
    expect((await send(suggestion({ refId: "intro" }))).status).toBe(400);
    expect((await send(suggestion({ text: "word ".repeat(5000) }))).status).toBe(400);
    staff = true;
    expect((await list()).suggestions).toEqual([]);
  });

  it("refuses an oversized body", async () => {
    const res = await send(suggestion({ text: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
  });

  it("answers a filled honeypot as a success but stores nothing", async () => {
    expect((await send(suggestion({ website: "http://spam.example" }))).status).toBe(200);
    staff = true;
    expect((await list()).suggestions).toEqual([]);
  });

  it("stores the same text for the same entry only once", async () => {
    expect((await send(suggestion())).status).toBe(200);
    expect((await send(suggestion(), "198.51.100.7")).status).toBe(200);
    staff = true;
    expect((await list()).suggestions).toHaveLength(1);
  });

  it("limits one sender to 5 an hour, with Retry-After, and others are unaffected", async () => {
    for (let n = 1; n <= 5; n++) expect((await send(suggestion({ text: textFor(n) }))).status).toBe(200);
    const sixth = await send(suggestion({ text: textFor(6) }));
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get("retry-after"))).toBeGreaterThan(3500);
    expect((await sixth.json()).error).toMatch(/in 1 hour/);

    expect((await send(suggestion({ text: textFor(7) }), "198.51.100.8")).status).toBe(200);

    // The same account is limited whatever address it comes from.
    await db.run(sql`DELETE FROM reference_text_suggestions`);
    signedInAs = "u1";
    for (let n = 1; n <= 5; n++) expect((await send(suggestion({ text: textFor(n) }), `192.0.2.${n}`)).status).toBe(200);
    expect((await send(suggestion({ text: textFor(9) }), "192.0.2.99")).status).toBe(429);
  });

  it("opens up again after the hour, and caps a day at 20", async () => {
    const sender = { ipHash: "h", userId: null, userAgent: null };
    const now = 1_800_000_000;
    for (let n = 0; n < 5; n++) {
      await db.run(
        sql`INSERT INTO reference_text_suggestions (id, page, ref_id, text, ip_hash, created_at) VALUES (${`a${n}`}, ${PAGE}, 'ref-a-1', 't', 'h', ${now - 10 * n})`,
      );
    }
    expect(await suggestionWaitSeconds(db as never, sender, now)).toBe(3600 - 40);
    expect(await suggestionWaitSeconds(db as never, sender, now + 3600)).toBe(0);

    for (let n = 5; n < 20; n++) {
      await db.run(
        sql`INSERT INTO reference_text_suggestions (id, page, ref_id, text, ip_hash, created_at) VALUES (${`a${n}`}, ${PAGE}, 'ref-a-1', 't', 'h', ${now - 7200 - n})`,
      );
    }
    expect(await suggestionWaitSeconds(db as never, sender, now + 3600)).toBeGreaterThan(3600);
    expect(await suggestionWaitSeconds(db as never, sender, now + 86_400 + 100)).toBe(0);
  });

  it("stops accepting suggestions for an entry that already has 25 waiting", async () => {
    for (let n = 0; n < 25; n++) {
      await db.run(
        sql`INSERT INTO reference_text_suggestions (id, page, ref_id, text, ip_hash) VALUES (${`p${n}`}, ${PAGE}, 'ref-ackerman-2020', ${`t${n}`}, ${`h${n}`})`,
      );
    }
    expect((await send(suggestion({ text: textFor(50) }))).status).toBe(429);
    expect((await send(suggestion({ refId: "ref-other-2021", text: textFor(50) }))).status).toBe(200);
  });
});

describe("/api/admin/reference-suggestions", () => {
  beforeEach(async () => {
    signedInAs = null;
    staff = false;
    await db.run(sql`CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL)`);
    await ensureSuggestionsTable(db as never);
    await db.run(sql`DELETE FROM reference_text_suggestions`);
  });

  it("lets only staff read, resolve or delete", async () => {
    await send(suggestion());
    expect((await admin.GET(new Request("https://debate-ai.com/api/admin/reference-suggestions"))).status).toBe(403);
    expect((await patch({ id: "x", status: "approved" })).status).toBe(403);
    expect((await del("x")).status).toBe(403);
  });

  it("approves, dismisses, reopens and deletes, filtering by status", async () => {
    await send(suggestion({ text: textFor(1) }));
    await send(suggestion({ text: textFor(2), refId: "ref-b-2021" }));
    staff = true;
    const { suggestions } = await list("pending");
    expect(suggestions).toHaveLength(2);
    const [first, second] = suggestions;

    expect((await patch({ id: first.id, status: "approved" })).status).toBe(200);
    expect((await patch({ id: second.id, status: "dismissed" })).status).toBe(200);
    expect((await list()).counts).toEqual({ pending: 0, approved: 1, dismissed: 1 });
    expect((await list("approved")).suggestions[0]).toMatchObject({ id: first.id, status: "approved", resolvedBy: "admin@debate-ai.com" });
    expect((await list("pending")).suggestions).toEqual([]);

    expect((await patch({ id: first.id, status: "pending" })).status).toBe(200);
    expect((await list("pending")).suggestions[0]).toMatchObject({ id: first.id, resolvedBy: null, resolvedAt: null });

    expect((await del(second.id)).status).toBe(200);
    expect((await list()).suggestions).toHaveLength(1);
  });

  it("validates ids and statuses", async () => {
    staff = true;
    expect((await patch({ id: "", status: "approved" })).status).toBe(400);
    expect((await patch({ id: "x", status: "bogus" })).status).toBe(400);
    expect((await patch({ id: "missing", status: "approved" })).status).toBe(404);
    expect((await del("missing")).status).toBe(404);
    expect((await admin.GET(new Request("https://debate-ai.com/api/admin/reference-suggestions?status=bogus"))).status).toBe(400);
  });
});
