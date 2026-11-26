/**
 * @fileoverview "Import existing emails" for the admin Emails section: the
 * merge rules (validate, lowercase, dedupe, drop unsubscribed, per-source
 * counts) on their own, and GET/POST /api/admin/emails/lists/import against a
 * real SQLite database with accounts, Stripe rows and unsubscribes in it.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

let db: ReturnType<typeof drizzle>;
let isAdmin = true;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : null }) }));
vi.mock("@/lib/env", () => ({ getEnv: () => undefined }));

const route = await import("@/app/api/admin/emails/lists/import/route");
const listsRoute = await import("@/app/api/admin/emails/lists/route");
const { buildCustomerImport } = await import("@/lib/emails/customers");
const { resetEmailTables } = await import("@/lib/emails/tables");
const { unsubscribeEmail } = await import("@/lib/emails/unsubscribe");
const { NextRequest } = await import("next/server");
const { CURRENT_CUSTOMERS_LIST_ID, DEFAULT_CUSTOMERS_LIST_NAME } = await import("@debate-ai/webview/lib/admin/email-customers");

describe("buildCustomerImport", () => {
  it("validates, lowercases and dedupes across sources, in source order", () => {
    const result = buildCustomerImport(
      [
        { id: "accounts", label: "Accounts", emails: ["Alex@Example.com", " sam@example.org ", "alex@example.com", "not-an-email", "", null] },
        { id: "stripe", label: "Stripe", emails: ["ALEX@example.com", "pat@example.net", undefined] },
      ],
      new Set(),
    );
    expect(result.emails).toEqual(["alex@example.com", "sam@example.org", "pat@example.net"]);
    expect(result.total).toBe(3);
    expect(result.invalid).toBe(1);
    expect(result.sources).toEqual([
      { id: "accounts", label: "Accounts", count: 2, added: 2 },
      { id: "stripe", label: "Stripe", count: 2, added: 1 },
    ]);
  });

  it("leaves out unsubscribed addresses and counts each once", () => {
    const result = buildCustomerImport(
      [
        { id: "a", label: "A", emails: ["gone@example.com", "Gone@Example.com", "keep@example.com"] },
        { id: "b", label: "B", emails: ["gone@example.com", "also-gone@example.com"] },
      ],
      new Set(["gone@example.com", "also-gone@example.com"]),
    );
    expect(result.emails).toEqual(["keep@example.com"]);
    expect(result.excludedUnsubscribed).toBe(2);
    expect(result.sources.map((source) => source.count)).toEqual([1, 0]);
  });

  it("handles no sources", () => {
    expect(buildCustomerImport([], new Set())).toEqual({ emails: [], total: 0, excludedUnsubscribed: 0, invalid: 0, sources: [] });
  });
});

const url = "https://d.ebate.app/api/admin/emails/lists/import";
const post = (body?: unknown) => route.POST(new Request(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }));

async function addUser(id: string, email: string, over: { anonymous?: boolean; banned?: boolean } = {}) {
  await db.run(
    sql`INSERT INTO user (id, name, email, is_anonymous, banned) VALUES (${id}, ${id}, ${email}, ${over.anonymous ? 1 : 0}, ${over.banned ? 1 : 0})`,
  );
}
async function addSubscription(id: string, email: string | null) {
  await db.run(sql`INSERT INTO stripe_subscriptions (subscription_id, email) VALUES (${id}, ${email})`);
}
const savedList = async () => {
  const res = await listsRoute.GET(new NextRequest(`https://d.ebate.app/api/admin/emails/lists?id=${CURRENT_CUSTOMERS_LIST_ID}`));
  return res.status === 200 ? (await res.json()).list : null;
};

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }));
  await db.run(sql`CREATE TABLE user (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, is_anonymous integer NOT NULL DEFAULT 0, banned integer DEFAULT 0)`);
  await db.run(sql`CREATE TABLE stripe_subscriptions (subscription_id text PRIMARY KEY, email text)`);
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS email_unsubscribes (email text PRIMARY KEY NOT NULL, unsubscribed_at integer DEFAULT (unixepoch()) NOT NULL, source text DEFAULT 'link' NOT NULL)`,
  );
  resetEmailTables();
  isAdmin = true;
});

describe("/api/admin/emails/lists/import", () => {
  it("is admin only and returns no addresses to anyone else", async () => {
    await addUser("u1", "alex@example.com");
    isAdmin = false;
    const preview = await route.GET();
    expect(preview.status).toBe(403);
    expect(JSON.stringify(await preview.json())).not.toContain("alex@example.com");
    expect((await post({})).status).toBe(403);
    expect(await savedList()).toBeNull();
  });

  it("previews counts by source without listing any address", async () => {
    await addUser("u1", "Alex@Example.com");
    await addUser("u2", "sam@example.org");
    await addUser("u3", "guest@example.com", { anonymous: true });
    await addUser("u4", "banned@example.com", { banned: true });
    await addSubscription("s1", "alex@example.com");
    await addSubscription("s2", "billing@example.net");
    await addSubscription("s3", null);
    await unsubscribeEmail(db, "sam@example.org");

    const res = await route.GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.preview).toMatchObject({
      total: 2,
      excludedUnsubscribed: 1,
      invalid: 0,
      existing: null,
      added: 2,
      removed: 0,
      sources: [
        { id: "accounts", count: 1, added: 1 },
        { id: "stripe", count: 2, added: 1 },
      ],
    });
    expect(JSON.stringify(body)).not.toMatch(/@/);
    expect(await savedList()).toBeNull();
  });

  it("saves the customers list, excluding unsubscribed addresses", async () => {
    await addUser("u1", "alex@example.com");
    await addUser("u2", "sam@example.org");
    await addSubscription("s1", "BILLING@example.net");
    await unsubscribeEmail(db, "sam@example.org");

    const res = await post({});
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.list).toMatchObject({ id: CURRENT_CUSTOMERS_LIST_ID, name: DEFAULT_CUSTOMERS_LIST_NAME, count: 2, updatedBy: "admin@example.com" });
    expect(body.list.emails).toBeUndefined();
    expect(body.report.excludedUnsubscribed).toBe(1);
    expect((await savedList()).emails).toEqual(["alex@example.com", "billing@example.net"]);
  });

  it("refreshes the same list in place: new users added, unsubscribed removed, no duplicates, name kept", async () => {
    await addUser("u1", "alex@example.com");
    await addUser("u2", "sam@example.org");
    await post({ name: "Everyone" });

    await addUser("u3", "new@example.com");
    await addSubscription("s1", "new@example.com");
    await unsubscribeEmail(db, "sam@example.org");

    const preview = (await (await route.GET()).json()).preview;
    expect(preview).toMatchObject({ existing: { id: CURRENT_CUSTOMERS_LIST_ID, name: "Everyone", count: 2 }, added: 1, removed: 1, total: 2 });

    const refreshed = await post({});
    expect(refreshed.status).toBe(200);
    const list = await savedList();
    expect(list.name).toBe("Everyone");
    expect(list.emails).toEqual(["alex@example.com", "new@example.com"]);

    const all = await (await listsRoute.GET(new NextRequest("https://d.ebate.app/api/admin/emails/lists"))).json();
    expect(all.lists).toHaveLength(1);

    await post({ name: "  All customers  " });
    expect((await savedList()).name).toBe("All customers");
  });

  it("rejects an empty import and a bad name", async () => {
    expect((await post({})).status).toBe(400);
    await addUser("u1", "alex@example.com");
    expect((await post({ name: "x".repeat(101) })).status).toBe(400);
    expect(await savedList()).toBeNull();
  });
});
