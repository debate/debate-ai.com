/**
 * @fileoverview The admin Emails section's saved lists, templates, Resend key
 * and bulk send routes, against a real SQLite database with rendering and
 * Resend stubbed: lists are validated and deduplicated, the key is stored
 * encrypted and never returned, and a send goes out in batches, skips
 * unsubscribed addresses and carries each recipient's unsubscribe link.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let db: ReturnType<typeof drizzle>;
let isAdmin = true;
const env: Record<string, string | undefined> = {};
const resend = vi.hoisted(() => ({
  keys: [] as string[],
  batches: [] as Array<Array<{ to: string[]; html: string; headers: Record<string, string> }>>,
}));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => cloudflare.context }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : null }) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/emails/render", () => ({
  renderCustomEmail: async ({ subject, body }: { subject: string; body: string }) => ({
    subject,
    html: `<p>${body}</p><a href="https://debate-ai.invalid/unsubscribe">Unsubscribe</a>`,
    text: body,
  }),
}));
vi.mock("resend", () => ({
  Resend: class {
    constructor(key: string) {
      resend.keys.push(key);
    }
    batch = {
      send: async (chunk: Array<{ to: string[]; html: string; headers: Record<string, string> }>) => {
        resend.batches.push(chunk);
        return { data: { data: chunk.map((_, i) => ({ id: `id_${i}` })), errors: [] }, error: null };
      },
    };
  },
}));
const cloudflare = vi.hoisted(() => ({ context: undefined as undefined | { env: Record<string, unknown> } }));

const lists = await import("@/app/api/admin/emails/lists/route");
const templates = await import("@/app/api/admin/emails/templates/route");
const keyRoute = await import("@/app/api/admin/emails/resend-key/route");
const campaign = await import("@/app/api/admin/emails/campaign/route");
const { resetEmailTables } = await import("@/lib/emails/tables");
const { unsubscribeEmail } = await import("@/lib/emails/unsubscribe");
const { resolveResendKey } = await import("@/lib/emails/settings");

const url = (path: string) => `https://d.ebate.app/api/admin/emails/${path}`;
const send = (handler: (req: NextRequest) => Promise<Response>, path: string, body: unknown, method = "POST") =>
  handler(new NextRequest(url(path), { method, body: JSON.stringify(body) }));
const get = (handler: (req: NextRequest) => Promise<Response>, path: string) => handler(new NextRequest(url(path)));

beforeEach(async () => {
  db = drizzle(createClient({ url: ":memory:" }));
  // unsubscribe.ts creates this once per isolate, so a fresh database needs it up front.
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS email_unsubscribes (email text PRIMARY KEY NOT NULL, unsubscribed_at integer DEFAULT (unixepoch()) NOT NULL, source text DEFAULT 'link' NOT NULL)`,
  );
  resetEmailTables();
  isAdmin = true;
  for (const key of Object.keys(env)) delete env[key];
  resend.keys = [];
  resend.batches = [];
  cloudflare.context = undefined;
});

describe("saved lists", () => {
  it("is admin only", async () => {
    isAdmin = false;
    expect((await get(lists.GET, "lists")).status).toBe(403);
    expect((await send(lists.POST, "lists", { name: "x", emails: "a@x.com" })).status).toBe(403);
  });

  it("saves a validated, deduplicated list and lists, edits and deletes it", async () => {
    const created = await (await send(lists.POST, "lists", { name: " Coaches ", emails: "B@x.com, a@x.com\nb@x.com" })).json();
    expect(created.list).toMatchObject({ name: "Coaches", count: 2, emails: ["b@x.com", "a@x.com"] });
    expect(created.duplicates).toBe(1);

    const summaries = await (await get(lists.GET, "lists")).json();
    expect(summaries.lists).toEqual([expect.objectContaining({ id: created.list.id, name: "Coaches", count: 2 })]);
    expect(summaries.lists[0]).not.toHaveProperty("emails");

    const edited = await (await send(lists.POST, "lists", { id: created.list.id, name: "Coaches 2", emails: "c@x.com" })).json();
    expect(edited.list).toMatchObject({ id: created.list.id, name: "Coaches 2", emails: ["c@x.com"] });
    expect((await (await get(lists.GET, `lists?id=${created.list.id}`)).json()).list.emails).toEqual(["c@x.com"]);

    await send(lists.DELETE, `lists?id=${created.list.id}`, undefined, "DELETE");
    expect((await (await get(lists.GET, "lists")).json()).lists).toEqual([]);
  });

  it("rejects invalid addresses, empty lists, missing names and unknown ids", async () => {
    const bad = await send(lists.POST, "lists", { name: "L", emails: "a@x.com, nope" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).invalid).toEqual(["nope"]);
    expect((await send(lists.POST, "lists", { name: "L", emails: "  " })).status).toBe(400);
    expect((await send(lists.POST, "lists", { name: " ", emails: "a@x.com" })).status).toBe(400);
    expect((await send(lists.POST, "lists", { id: "missing", name: "L", emails: "a@x.com" })).status).toBe(404);
    expect((await (await get(lists.GET, "lists")).json()).lists).toEqual([]);
  });
});

describe("saved templates", () => {
  it("saves, edits, previews and deletes a template, and offers the Welcome starter", async () => {
    const listed = await (await get(templates.GET, "templates")).json();
    expect(listed.templates).toEqual([]);
    expect(listed.starter.subject).toBe("Welcome to Debate AI");

    const created = await (await send(templates.POST, "templates", { name: "News", subject: "Hi", body: "Body" })).json();
    expect(created.template).toMatchObject({ name: "News", subject: "Hi", body: "Body" });
    const edited = await (await send(templates.POST, "templates", { id: created.template.id, name: "News", subject: "Hi 2", body: "Body" })).json();
    expect(edited.template.subject).toBe("Hi 2");

    const preview = await (await send(templates.POST, "templates", { action: "preview", subject: "Hi", body: "Hello" })).json();
    expect(preview.html).toContain("Hello");

    expect((await send(templates.POST, "templates", { name: "x", subject: "", body: "b" })).status).toBe(400);
    expect((await send(templates.POST, "templates", { name: "x", subject: "two\nlines", body: "b" })).status).toBe(400);

    await send(templates.DELETE, `templates?id=${created.template.id}`, undefined, "DELETE");
    expect((await (await get(templates.GET, "templates")).json()).templates).toEqual([]);
  });
});

describe("Resend key", () => {
  const KEY = "re_SECRETKEYvalue1234567890abcd";

  it("stores it encrypted, reports only its last four characters, and never returns it", async () => {
    const saved = await send(keyRoute.POST, "resend-key", { key: KEY });
    const body = await saved.text();
    expect(saved.status).toBe(200);
    expect(body).not.toContain(KEY);
    expect(body).not.toContain("SECRETKEY");
    expect(JSON.parse(body).status).toMatchObject({ saved: true, endsIn: "abcd", source: "saved", unreadable: false });

    const status = await (await get(keyRoute.GET, "resend-key")).text();
    expect(status).not.toContain("SECRETKEY");

    const [row] = (await db.all(sql`SELECT value_enc, hint FROM email_settings`)) as Array<{ value_enc: string; hint: string }>;
    expect(row.value_enc.startsWith("v1.")).toBe(true);
    expect(row.value_enc).not.toContain("SECRETKEY");
    expect(row.hint).toBe("abcd");

    expect((await resolveResendKey(db))?.key).toBe(KEY);
  });

  it("replaces and removes the key, falling back to the env secret", async () => {
    env.RESEND_API_KEY = "re_fromenvvalue9999";
    expect((await resolveResendKey(db))).toEqual({ key: "re_fromenvvalue9999", source: "env" });
    expect((await (await get(keyRoute.GET, "resend-key")).json()).status).toMatchObject({ saved: false, envFallback: true, source: "env" });

    await send(keyRoute.POST, "resend-key", { key: KEY });
    await send(keyRoute.POST, "resend-key", { key: "re_replacement000000wxyz" });
    expect((await resolveResendKey(db))).toEqual({ key: "re_replacement000000wxyz", source: "saved" });

    const removed = await (await send(keyRoute.DELETE, "resend-key", undefined, "DELETE")).json();
    expect(removed.status).toMatchObject({ saved: false, endsIn: "", source: "env" });
    expect((await resolveResendKey(db))?.source).toBe("env");
  });

  it("treats a key it cannot decrypt as absent", async () => {
    await send(keyRoute.POST, "resend-key", { key: KEY });
    env.BETTER_AUTH_SECRET = "a-different-secret";
    const status = (await (await get(keyRoute.GET, "resend-key")).json()).status;
    expect(status).toMatchObject({ saved: false, unreadable: true, endsIn: "" });
    expect(await resolveResendKey(db)).toBeNull();
  });

  it("rejects values that are not Resend keys and non-admins", async () => {
    expect((await send(keyRoute.POST, "resend-key", { key: "sk-nope" })).status).toBe(400);
    expect((await send(keyRoute.POST, "resend-key", {})).status).toBe(400);
    isAdmin = false;
    expect((await send(keyRoute.POST, "resend-key", { key: KEY })).status).toBe(403);
    expect((await get(keyRoute.GET, "resend-key")).status).toBe(403);
  });
});

describe("bulk send", () => {
  async function setup(count: number) {
    const emails = Array.from({ length: count }, (_, i) => `user${i}@x.com`);
    const list = (await (await send(lists.POST, "lists", { name: "All", emails })).json()).list;
    const template = (await (await send(templates.POST, "templates", { name: "T", subject: "Hello", body: "Hi" })).json()).template;
    return { list, template, emails };
  }

  it("reports which providers are ready", async () => {
    let data = await (await get(campaign.GET, "campaign")).json();
    expect(data.providers).toMatchObject({ resend: { ready: false, batchSize: 100 }, cloudflare: { ready: false } });
    await send(keyRoute.POST, "resend-key", { key: "re_abcdefghijkl1234" });
    cloudflare.context = { env: { EMAIL: { send: async () => undefined } } };
    data = await (await get(campaign.GET, "campaign")).json();
    expect(data.providers.resend.ready).toBe(true);
    expect(data.providers.cloudflare.ready).toBe(true);
  });

  it("refuses without a key or binding", async () => {
    const { list, template } = await setup(2);
    expect((await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "resend" })).status).toBe(503);
    expect((await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "cloudflare" })).status).toBe(503);
    expect(resend.batches).toHaveLength(0);
  });

  it("sends the saved list through Resend one 100-address batch at a time with the saved key", async () => {
    await send(keyRoute.POST, "resend-key", { key: "re_savedkey1234567890" });
    const { list, template, emails } = await setup(230);

    const first = await (await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "resend" })).json();
    expect(first).toMatchObject({ total: 230, nextOffset: 100, totals: { sent: 100, failed: 0, skipped: 0 } });
    const second = await (await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "resend", offset: first.nextOffset })).json();
    expect(second.nextOffset).toBe(200);
    const third = await (await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "resend", offset: second.nextOffset })).json();
    expect(third).toMatchObject({ nextOffset: null, totals: { sent: 30 } });

    expect(resend.keys.every((key) => key === "re_savedkey1234567890")).toBe(true);
    expect(resend.batches.map((batch) => batch.length)).toEqual([100, 100, 30]);
    expect(resend.batches.flat().map((message) => message.to[0])).toEqual(emails);
  });

  it("skips unsubscribed addresses and links every email to its own unsubscribe page", async () => {
    env.RESEND_API_KEY = "re_fromenv1234567890";
    const { list, template } = await setup(3);
    await unsubscribeEmail(db, "user1@x.com");

    const data = await (await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "resend" })).json();
    expect(data.totals).toEqual({ sent: 2, failed: 0, skipped: 1 });
    expect(data.results.map((result: { email: string; status: string }) => [result.email, result.status])).toEqual([
      ["user0@x.com", "sent"],
      ["user1@x.com", "skipped"],
      ["user2@x.com", "sent"],
    ]);
    expect(data.results[1].error).toMatch(/unsubscribed/i);

    const messages = resend.batches.flat();
    expect(messages.map((message) => message.to[0])).toEqual(["user0@x.com", "user2@x.com"]);
    for (const message of messages) {
      expect(message.html).toContain("https://d.ebate.app/unsubscribe?t=");
      expect(message.html).not.toContain("debate-ai.invalid");
      expect(message.headers["List-Unsubscribe"]).toContain("/unsubscribe?t=");
    }
  });

  it("sends through the Cloudflare binding when picked", async () => {
    const sent: Array<{ to: string; html: string }> = [];
    cloudflare.context = { env: { EMAIL: { send: async (message: { to: string; html: string }) => (sent.push(message), { messageId: "cf1" }) } } };
    const { list, template } = await setup(2);
    const data = await (await send(campaign.POST, "campaign", { templateId: template.id, listId: list.id, provider: "cloudflare" })).json();
    expect(data).toMatchObject({ nextOffset: null, totals: { sent: 2 } });
    expect(sent.map((message) => message.to)).toEqual(["user0@x.com", "user1@x.com"]);
    expect(sent[0].html).toContain("/unsubscribe?t=");
    expect(resend.batches).toHaveLength(0);
  });

  it("validates its input and is admin only", async () => {
    env.RESEND_API_KEY = "re_fromenv1234567890";
    const { list, template } = await setup(2);
    const body = { templateId: template.id, listId: list.id, provider: "resend" };
    expect((await send(campaign.POST, "campaign", { ...body, provider: "smtp" })).status).toBe(400);
    expect((await send(campaign.POST, "campaign", { ...body, offset: -1 })).status).toBe(400);
    expect((await send(campaign.POST, "campaign", { ...body, offset: 5 })).status).toBe(400);
    expect((await send(campaign.POST, "campaign", { ...body, templateId: "nope" })).status).toBe(404);
    expect((await send(campaign.POST, "campaign", { ...body, listId: "nope" })).status).toBe(404);
    isAdmin = false;
    expect((await send(campaign.POST, "campaign", body)).status).toBe(403);
    expect(resend.batches).toHaveLength(0);
  });
});
