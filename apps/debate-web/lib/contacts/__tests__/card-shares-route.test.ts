/**
 * @fileoverview `/api/card-shares` against a real SQLite database: a co-edit
 * share code goes only to accepted, unblocked contacts (or members of the
 * active organization), re-sharing a room upserts instead of duplicating, the
 * recipient can mark it opened or dismiss it, the owner revokes it, and the
 * file-invite email is best-effort.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let me: string | null = "ana";
let activeOrganizationId: string | null = null;
let dbFails: Error | null = null;
const env: Record<string, string | undefined> = {};
const sent: Array<{ to: string; subject: string }> = [];
let sendResult: (to: string) => Promise<{ error: unknown }> = async () => ({ error: null });

const NAMES: Record<string, string> = { ana: "Ana", ben: "Ben", cy: "Cy", dee: "Dee" };

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (dbFails) throw dbFails;
    return db;
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () =>
    me ? { user: { id: me, name: NAMES[me], email: `${me}@example.com` }, session: { activeOrganizationId } } : null,
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/emails/render", () => ({
  renderEmail: async (_template: string, props: { fileTitle: string }) => ({
    subject: `Invite: ${props.fileTitle}`,
    html: "<p>hi</p>",
    text: "hi",
  }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: { to: string; subject: string }) => {
        sent.push({ to: message.to, subject: message.subject });
        return sendResult(message.to);
      },
    };
  },
}));

const { GET, POST, PATCH, DELETE } = await import("@/app/api/card-shares/route");

const ROOM = "0123456789abcdef";
const KEY = "A".repeat(43);
const CODE = `cmshare1.${ROOM}.${KEY}`;
const base = "https://debate-ai.com/api/card-shares";

const share = (body: unknown) =>
  POST(new NextRequest(base, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const markOpened = (body: unknown) =>
  PATCH(new NextRequest(base, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) }));
const remove = (id: unknown) => DELETE(new NextRequest(`${base}?id=${id}`, { method: "DELETE" }));
const list = async () => (await GET()).json();
const shareRows = () => db.select().from(schema.cardShares);

async function befriend(a: string, b: string) {
  const now = new Date();
  await db.insert(schema.contacts).values({ requesterId: a, addresseeId: b, status: "accepted", createdAt: now, updatedAt: now });
}

beforeEach(async () => {
  me = "ana";
  activeOrganizationId = null;
  dbFails = null;
  for (const key of Object.keys(env)) delete env[key];
  sent.length = 0;
  sendResult = async () => ({ error: null });
  const client = await freshSchemaClient();
  await client.execute("PRAGMA foreign_keys = ON");
  db = drizzle(client, { schema });
  const now = new Date();
  await db.insert(schema.user).values(
    Object.entries(NAMES).map(([id, name]) => ({ id, name, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
  );
  await befriend("ana", "ben");
  await befriend("cy", "ana");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth and validation", () => {
  it("answers 401 signed out", async () => {
    me = null;
    expect((await GET()).status).toBe(401);
    expect((await share({ shareCode: CODE, recipientIds: [] })).status).toBe(401);
    expect((await markOpened({ id: 1, action: "opened" })).status).toBe(401);
    expect((await remove(1)).status).toBe(401);
  });

  it("rejects a malformed body, share code or recipient list", async () => {
    expect((await share("nope")).status).toBe(400);
    expect((await share({ shareCode: "cmshare1.nothex.zzz", recipientIds: ["ben"] })).status).toBe(400);
    expect((await share({ shareCode: 42, recipientIds: ["ben"] })).status).toBe(400);
    expect((await share({ shareCode: CODE, recipientIds: "ben" })).status).toBe(400);
    expect((await share({ shareCode: CODE, recipientIds: ["ben", 7] })).status).toBe(400);
  });
});

describe("POST", () => {
  it("shares only with accepted, unblocked contacts and reports the rest as skipped", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await db.insert(schema.userBlocks).values({ blockerId: "cy", blockedId: "ana", createdAt: new Date() });
    const res = await share({ shareCode: ` ${CODE} `, recipientIds: ["ben", "cy", "dee", "ben", "ana"], title: "  Aff 1AC  ", message: "  read this " });
    expect(await res.json()).toEqual({ shared: ["ben"], skipped: ["cy", "dee", "ana"] });

    const [row] = await shareRows();
    expect(row).toMatchObject({ ownerId: "ana", recipientId: "ben", roomId: ROOM, shareCode: CODE, title: "Aff 1AC", message: "read this", guestPass: null });
    const [note] = await db.select().from(schema.notifications);
    expect(note).toMatchObject({ userId: "ben", type: "card_shared", title: 'Ana shared "Aff 1AC" with you', body: "read this", link: "/contacts?tab=shared" });
  });

  it("defaults a blank title and clips the guest pass", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await share({ shareCode: CODE, recipientIds: ["ben"], guestPass: ` ${"p".repeat(600)} ` });
    const [row] = await shareRows();
    expect(row.title).toBe("Untitled document");
    expect(row.guestPass).toHaveLength(512);
    expect(row.message).toBeNull();
  });

  it("re-sharing a room refreshes the row and clears a revoke and an open", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await share({ shareCode: CODE, recipientIds: ["ben"], title: "v1" });
    const [first] = await shareRows();
    await remove(first.id); // owner revokes
    me = "ben";
    await markOpened({ id: first.id, action: "opened" });
    me = "ana";
    const newCode = `cmshare2.${ROOM}.${"B".repeat(43)}.1.2.0`;
    await share({ shareCode: newCode, recipientIds: ["ben"], title: "v2", guestPass: "pass" });

    const rows = await shareRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first.id, shareCode: newCode, title: "v2", guestPass: "pass", revokedAt: null, openedAt: null });
  });

  it("shares with members of the active organization who are not personal contacts", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const now = new Date();
    await db.insert(schema.organization).values({ id: "org", name: "Team", slug: "team", createdAt: now });
    await db.insert(schema.member).values(
      ["ana", "dee"].map((userId, i) => ({ id: `m${i}`, organizationId: "org", userId, role: "member", createdAt: now })),
    );
    activeOrganizationId = "org";
    expect(await (await share({ shareCode: CODE, recipientIds: ["dee"] })).json()).toEqual({ shared: ["dee"], skipped: [] });
  });

  it("emails each recipient when a Resend key is set, and a failed email never fails the share", async () => {
    env.RESEND_API_KEY = "re_test";
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    sendResult = async (to) => (to === "cy@example.com" ? { error: new Error("bounced") } : { error: null });
    const res = await share({ shareCode: CODE, recipientIds: ["ben", "cy"], title: "Neg" });
    expect(res.status).toBe(200);
    expect(sent.map((s) => s.to).sort()).toEqual(["ben@example.com", "cy@example.com"]);
    expect(sent[0].subject).toBe("Invite: Neg");
    expect(errors).toHaveBeenCalledWith("Failed to email a card share", expect.any(Error));
  });

  it("falls back to AUTH_RESEND_KEY, and sends no email when nothing was shared", async () => {
    env.AUTH_RESEND_KEY = "re_auth";
    await share({ shareCode: CODE, recipientIds: ["dee"] });
    expect(sent).toHaveLength(0);
    await share({ shareCode: CODE, recipientIds: ["ben"] });
    expect(sent.map((s) => s.to)).toEqual(["ben@example.com"]);
  });

  it("answers 500 when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbFails = new Error("boom");
    expect((await share({ shareCode: CODE, recipientIds: ["ben"] })).status).toBe(500);
  });
});

describe("GET", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await share({ shareCode: CODE, recipientIds: ["ben", "cy"], title: "Mine" });
    me = "ben";
    await befriend("ben", "dee");
    await share({ shareCode: `cmshare1.${"f".repeat(16)}.${KEY}`, recipientIds: ["ana"], title: "From Ben" });
    me = "ana";
  });

  it("lists live received and sent shares with the other party", async () => {
    const body = await list();
    expect(body.received.map((r: { title: string; user: { id: string } }) => [r.title, r.user.id])).toEqual([["From Ben", "ben"]]);
    expect(body.sent.map((r: { user: { id: string } }) => r.user.id).sort()).toEqual(["ben", "cy"]);
    expect(body.sent[0]).toMatchObject({ roomId: ROOM, shareCode: CODE, guestPass: null, message: null, openedAt: null });
    expect(body.sent[0].createdAt).toMatch(/Z$/);
  });

  it("hides revoked shares from both sides", async () => {
    const ownRow = (await shareRows()).find((r) => r.recipientId === "cy")!;
    await remove(ownRow.id);
    expect((await list()).sent.map((r: { user: { id: string } }) => r.user.id)).toEqual(["ben"]);
    me = "cy";
    expect((await list()).received).toEqual([]);
  });

  it("narrows both lists to the active organization's members", async () => {
    const now = new Date();
    await db.insert(schema.organization).values({ id: "org", name: "Team", slug: "team", createdAt: now });
    await db.insert(schema.member).values(
      ["ana", "cy"].map((userId, i) => ({ id: `m${i}`, organizationId: "org", userId, role: "member", createdAt: now })),
    );
    activeOrganizationId = "org";
    const body = await list();
    expect(body.received).toEqual([]);
    expect(body.sent.map((r: { user: { id: string } }) => r.user.id)).toEqual(["cy"]);
  });

  it("degrades to empty lists before the migration", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await db.run("DROP TABLE card_shares" as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: [], sent: [] });
  });

  it("answers 500 on an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbFails = new Error("boom");
    expect((await GET()).status).toBe(500);
  });
});

describe("PATCH and DELETE", () => {
  let rowId: number;
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await share({ shareCode: CODE, recipientIds: ["ben"] });
    rowId = (await shareRows())[0].id;
  });

  it("validates the PATCH body", async () => {
    me = "ben";
    expect((await markOpened("x")).status).toBe(400);
    expect((await markOpened({ id: "abc", action: "opened" })).status).toBe(400);
    expect((await markOpened({ id: rowId, action: "closed" })).status).toBe(400);
  });

  it("marks the first open only, and only for the recipient", async () => {
    await markOpened({ id: rowId, action: "opened" }); // the owner: ignored
    expect((await shareRows())[0].openedAt).toBeNull();

    me = "ben";
    await markOpened({ id: rowId, action: "opened" });
    const firstOpen = (await shareRows())[0].openedAt;
    expect(firstOpen).toBeInstanceOf(Date);
    await db.update(schema.cardShares).set({ openedAt: new Date(1_000_000) });
    await markOpened({ id: rowId, action: "opened" });
    expect((await shareRows())[0].openedAt?.getTime()).toBe(1_000_000);
  });

  it("lets the owner revoke (row kept) and the recipient dismiss (row deleted)", async () => {
    expect((await remove(rowId)).status).toBe(200);
    expect((await shareRows())[0].revokedAt).toBeInstanceOf(Date);
    me = "ben";
    expect((await remove(rowId)).status).toBe(200);
    expect(await shareRows()).toHaveLength(0);
  });

  it("hides the share from anyone else, and rejects a bad id", async () => {
    me = "cy";
    expect((await remove(rowId)).status).toBe(404);
    expect((await remove("abc")).status).toBe(400);
    expect((await remove(12345)).status).toBe(404);
  });

  it("answers 500 when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbFails = new Error("boom");
    me = "ben";
    expect((await markOpened({ id: rowId, action: "opened" })).status).toBe(500);
    expect((await remove(rowId)).status).toBe(500);
  });
});
