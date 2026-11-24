/**
 * @fileoverview `/api/contacts` against a real SQLite database: sending,
 * auto-accepting, accepting, declining and removing contact requests, the
 * notifications each step writes, blocks, presence, and the organization
 * roster that replaces the personal list while an organization is active.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let me: string | null = "ana";
let activeOrganizationId: string | null = null;
let dbFails: Error | null = null;

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

const { GET, POST, PATCH, DELETE } = await import("@/app/api/contacts/route");

const base = "https://debate-ai.com/api/contacts";
const send = (body: unknown) =>
  POST(new NextRequest(base, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const respond = (body: unknown) =>
  PATCH(new NextRequest(base, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) }));
const remove = (id: unknown) => DELETE(new NextRequest(`${base}?id=${id}`, { method: "DELETE" }));
const list = async () => (await GET()).json();
const as = (id: string | null) => {
  me = id;
};
const contactRows = () => db.select().from(schema.contacts);
const notificationsFor = async (userId: string) =>
  (await db.select().from(schema.notifications)).filter((n) => n.userId === userId);

beforeEach(async () => {
  me = "ana";
  activeOrganizationId = null;
  dbFails = null;
  const client = await freshSchemaClient();
  await client.execute("PRAGMA foreign_keys = ON");
  db = drizzle(client, { schema });
  const now = new Date();
  await db.insert(schema.user).values(
    Object.entries(NAMES).map(([id, name]) => ({ id, name, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
  );
});

describe("signed out", () => {
  it("answers 401 on every method", async () => {
    as(null);
    expect((await GET()).status).toBe(401);
    expect((await send({ userId: "ben" })).status).toBe(401);
    expect((await respond({ id: 1, action: "accept" })).status).toBe(401);
    expect((await remove(1)).status).toBe(401);
  });
});

describe("POST", () => {
  it("validates the body and the target", async () => {
    expect((await send("{")).status).toBe(400);
    expect((await send({})).status).toBe(400);
    expect((await send({ userId: "   " })).status).toBe(400);
    expect((await send({ userId: "nobody" })).status).toBe(404);
    expect((await send({ email: "nobody@example.com" })).status).toBe(404);
  });

  it("refuses a request to yourself", async () => {
    expect((await send({ userId: "ana" })).status).toBe(400);
  });

  it("creates a pending request and notifies the addressee", async () => {
    const res = await send({ email: "ben@example.com" });
    expect(await res.json()).toEqual({ status: "requested" });
    expect(await contactRows()).toMatchObject([{ requesterId: "ana", addresseeId: "ben", status: "pending" }]);
    const [note] = await notificationsFor("ben");
    expect(note).toMatchObject({ type: "contact_request", title: "Ana wants to add you as a contact", body: "ana@example.com", link: "/contacts" });
  });

  it("does nothing on a repeat request", async () => {
    await send({ userId: "ben" });
    expect(await (await send({ userId: "ben" })).json()).toEqual({ status: "already-requested" });
    expect(await contactRows()).toHaveLength(1);
  });

  it("accepts on the spot when the other side already asked", async () => {
    as("ben");
    await send({ userId: "ana" });
    as("ana");
    expect(await (await send({ userId: "ben" })).json()).toEqual({ status: "accepted" });
    expect(await contactRows()).toMatchObject([{ requesterId: "ben", addresseeId: "ana", status: "accepted" }]);
    expect((await notificationsFor("ben")).map((n) => n.type)).toEqual(["contact_accepted"]);
    expect(await (await send({ userId: "ben" })).json()).toEqual({ status: "already-contacts" });
  });

  it("refuses with 403 when either side blocked the other", async () => {
    await db.insert(schema.userBlocks).values({ blockerId: "ben", blockedId: "ana", createdAt: new Date() });
    expect((await send({ userId: "ben" })).status).toBe(403);
    expect(await contactRows()).toHaveLength(0);
  });
});

describe("PATCH", () => {
  let requestId: number;
  beforeEach(async () => {
    await send({ userId: "ben" });
    requestId = (await contactRows())[0].id;
  });

  it("validates the id and action", async () => {
    as("ben");
    expect((await respond("x")).status).toBe(400);
    expect((await respond({ id: "abc", action: "accept" })).status).toBe(400);
    expect((await respond({ id: requestId, action: "block" })).status).toBe(400);
  });

  it("lets only the addressee act, hiding the request from everyone else", async () => {
    expect((await respond({ id: requestId, action: "accept" })).status).toBe(404);
    as("cy");
    expect((await respond({ id: requestId, action: "accept" })).status).toBe(404);
    expect((await contactRows())[0].status).toBe("pending");
  });

  it("accepts, notifying the requester, and cannot accept twice", async () => {
    as("ben");
    expect(await (await respond({ id: requestId, action: "accept" })).json()).toEqual({ ok: true, status: "accepted" });
    expect((await contactRows())[0].status).toBe("accepted");
    expect((await notificationsFor("ana")).map((n) => n.title)).toEqual(["Ben accepted your contact request"]);
    expect((await respond({ id: requestId, action: "decline" })).status).toBe(404);
  });

  it("declines by deleting the request", async () => {
    as("ben");
    expect(await (await respond({ id: requestId, action: "decline" })).json()).toEqual({ ok: true, status: "declined" });
    expect(await contactRows()).toHaveLength(0);
  });
});

describe("DELETE", () => {
  it("rejects a non-numeric id", async () => {
    expect((await remove("abc")).status).toBe(400);
  });

  it("lets the requester cancel a pending request but not the addressee", async () => {
    await send({ userId: "ben" });
    const [row] = await contactRows();
    as("ben");
    expect((await remove(row.id)).status).toBe(404);
    as("ana");
    expect(await (await remove(row.id)).json()).toEqual({ ok: true });
    expect(await contactRows()).toHaveLength(0);
  });

  it("lets either side remove an accepted contact, and no one else", async () => {
    await send({ userId: "ben" });
    const [row] = await contactRows();
    as("ben");
    await respond({ id: row.id, action: "accept" });
    as("cy");
    expect((await remove(row.id)).status).toBe(404);
    as("ben");
    expect((await remove(row.id)).status).toBe(200);
    expect(await contactRows()).toHaveLength(0);
  });

  it("answers 404 for an id that does not exist", async () => {
    expect((await remove(999)).status).toBe(404);
  });
});

describe("GET", () => {
  it("splits pairs into contacts, incoming and outgoing, and lists blocks", async () => {
    await send({ userId: "ben" }); // outgoing
    as("cy");
    await send({ userId: "ana" }); // incoming for ana
    as("dee");
    await send({ userId: "ana" });
    as("ana");
    const deeRow = (await contactRows()).find((r) => r.requesterId === "dee")!;
    await send({ userId: "dee" }); // auto-accept → contact
    await db.insert(schema.userBlocks).values({ blockerId: "ana", blockedId: "ben", createdAt: new Date() });

    const body = await list();
    expect(body.organization).toBeNull();
    expect(body.contacts).toHaveLength(1);
    expect(body.contacts[0]).toMatchObject({ id: deeRow.id, user: { id: "dee", name: "Dee", email: "dee@example.com", image: null } });
    expect(body.contacts[0].since).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(body.incoming.map((r: { user: { id: string } }) => r.user.id)).toEqual(["cy"]);
    expect(body.outgoing.map((r: { user: { id: string } }) => r.user.id)).toEqual(["ben"]);
    expect(body.blocked.map((r: { user: { id: string } }) => r.user.id)).toEqual(["ben"]);
  });

  it("is the presence heartbeat: polling marks the caller, and a contact who polled reads online", async () => {
    await send({ userId: "ben" });
    as("ben");
    const [row] = await contactRows();
    await respond({ id: row.id, action: "accept" });
    await list();
    as("ana");
    const body = await list();
    expect(body.contacts[0].online).toBe(true);
    expect(body.contacts[0].lastSeenAt).not.toBeNull();
    const presence = await db.select().from(schema.userPresence);
    expect(presence.map((p) => p.userId).sort()).toEqual(["ana", "ben"]);
  });

  it("shows a contact who never polled as offline", async () => {
    await send({ userId: "ben" });
    as("ben");
    await respond({ id: (await contactRows())[0].id, action: "accept" });
    as("ana");
    const body = await list();
    expect(body.contacts[0]).toMatchObject({ online: false, lastSeenAt: null });
  });

  it("lists the active organization's other members instead, minus blocks either way", async () => {
    const now = new Date();
    await db.insert(schema.organization).values({ id: "org1", name: "Greenhill", slug: "greenhill", createdAt: now });
    await db.insert(schema.member).values(
      ["ana", "ben", "cy", "dee"].map((userId, i) => ({ id: `m${i}`, organizationId: "org1", userId, role: userId === "ana" ? "owner" : "member", createdAt: now })),
    );
    await db.insert(schema.userBlocks).values({ blockerId: "cy", blockedId: "ana", createdAt: now });
    await send({ userId: "ben" });
    as("ben");
    const benRow = (await contactRows())[0];
    await respond({ id: benRow.id, action: "accept" });
    as("ana");
    activeOrganizationId = "org1";

    const body = await list();
    expect(body.organization).toEqual({ id: "org1", name: "Greenhill", role: "owner" });
    const byId = Object.fromEntries(body.contacts.map((c: { id: number; user: { id: string } }) => [c.user.id, c.id]));
    // Ben is also a personal contact, so he carries that row's id; Dee does not.
    expect(byId).toEqual({ ben: benRow.id, dee: 0 });
  });

  it("falls back to the personal list for an organization the caller is not in", async () => {
    const now = new Date();
    await db.insert(schema.organization).values({ id: "org2", name: "Other", slug: "other", createdAt: now });
    activeOrganizationId = "org2";
    expect((await list()).organization).toBeNull();
  });

  it("degrades to empty lists before the contacts migration", async () => {
    await db.run("DROP TABLE contacts" as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ organization: null, contacts: [], incoming: [], outgoing: [], blocked: [] });
  });

  it("answers 500 on an unexpected failure", async () => {
    dbFails = new Error("boom");
    expect((await GET()).status).toBe(500);
  });
});
