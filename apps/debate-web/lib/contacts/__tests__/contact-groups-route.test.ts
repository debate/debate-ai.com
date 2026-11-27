/**
 * @fileoverview `/api/contacts/groups` against a real SQLite database: group
 * CRUD scoped to the owner, name rules, and the membership filter that keeps
 * non-contacts and blocked users out of a group.
 */

import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let me: string | null = "ana";

const IDS = ["ana", "ben", "cy", "dee", "eli"];

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () =>
    me ? { user: { id: me, name: me, email: `${me}@example.com` }, session: { activeOrganizationId: null } } : null,
}));

const { GET, POST, PATCH, DELETE } = await import("@/app/api/contacts/groups/route");

const base = "https://debate-ai.com/api/contacts/groups";
const body = (b: unknown) => (typeof b === "string" ? b : JSON.stringify(b));
const create = (b: unknown) => POST(new NextRequest(base, { method: "POST", body: body(b) }));
const edit = (b: unknown) => PATCH(new NextRequest(base, { method: "PATCH", body: body(b) }));
const remove = (id: unknown) => DELETE(new NextRequest(`${base}?id=${id}`, { method: "DELETE" }));
const list = async () => (await GET()).json();

beforeEach(async () => {
  me = "ana";
  const client = await freshSchemaClient();
  await client.execute("PRAGMA foreign_keys = ON");
  db = drizzle(client, { schema });
  const now = new Date();
  await db
    .insert(schema.user)
    .values(IDS.map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
  await db.insert(schema.contacts).values([
    { requesterId: "ana", addresseeId: "ben", status: "accepted" },
    { requesterId: "cy", addresseeId: "ana", status: "accepted" },
    { requesterId: "ana", addresseeId: "dee", status: "pending" },
  ]);
});

describe("signed out", () => {
  it("answers 401 on every method", async () => {
    me = null;
    expect((await GET()).status).toBe(401);
    expect((await create({ name: "x" })).status).toBe(401);
    expect((await edit({ id: 1 })).status).toBe(401);
    expect((await remove(1)).status).toBe(401);
  });
});

describe("POST", () => {
  it("validates the body", async () => {
    expect((await create("{")).status).toBe(400);
    expect((await create({})).status).toBe(400);
    expect((await create({ name: "   " })).status).toBe(400);
    expect((await create({ name: "A", memberIds: "ben" })).status).toBe(400);
    expect((await create({ name: "A", memberIds: [1] })).status).toBe(400);
  });

  it("creates a group and keeps only accepted, unblocked contacts", async () => {
    await db.insert(schema.userBlocks).values({ blockerId: "ana", blockedId: "cy", createdAt: new Date() });
    const res = await create({ name: "  Varsity   squad ", memberIds: ["ben", "cy", "dee", "eli", "ana", "ben"] });
    expect(await res.json()).toMatchObject({ group: { name: "Varsity squad", memberIds: ["ben"] } });
    expect((await list()).groups).toEqual([{ id: expect.any(Number), name: "Varsity squad", memberIds: ["ben"] }]);
  });

  it("refuses a duplicate name, ignoring case, but only within one owner", async () => {
    expect((await create({ name: "Team" })).status).toBe(200);
    expect((await create({ name: "team" })).status).toBe(409);
    me = "ben";
    expect((await create({ name: "Team" })).status).toBe(200);
  });
});

describe("GET", () => {
  it("lists only the caller's groups, by name", async () => {
    await create({ name: "Zeta", memberIds: ["ben"] });
    await create({ name: "Alpha", memberIds: ["ben", "cy"] });
    me = "ben";
    await create({ name: "Mine" });
    me = "ana";
    const { groups } = await list();
    expect(groups.map((g: { name: string }) => g.name)).toEqual(["Alpha", "Zeta"]);
    expect(groups[0].memberIds.sort()).toEqual(["ben", "cy"]);
  });
});

describe("PATCH", () => {
  let id: number;
  beforeEach(async () => {
    id = (await (await create({ name: "Lab", memberIds: ["ben"] })).json()).group.id;
  });

  it("renames and replaces members", async () => {
    const res = await edit({ id, name: "Lab 2", memberIds: ["cy", "eli"] });
    expect(await res.json()).toEqual({ group: { id, name: "Lab 2", memberIds: ["cy"] } });
    expect((await list()).groups).toEqual([{ id, name: "Lab 2", memberIds: ["cy"] }]);
  });

  it("changes only what is sent", async () => {
    expect(await (await edit({ id, name: "Renamed" })).json()).toEqual({
      group: { id, name: "Renamed", memberIds: ["ben"] },
    });
    expect(await (await edit({ id, memberIds: [] })).json()).toEqual({ group: { id, name: "Renamed", memberIds: [] } });
  });

  it("rejects bad input, a clashing name, and groups that are not yours", async () => {
    expect((await edit("{")).status).toBe(400);
    expect((await edit({ name: "x" })).status).toBe(400);
    expect((await edit({ id, name: " " })).status).toBe(400);
    expect((await edit({ id, memberIds: "ben" })).status).toBe(400);
    expect((await edit({ id: 9999, name: "x" })).status).toBe(404);
    await create({ name: "Other" });
    expect((await edit({ id, name: "other" })).status).toBe(409);
    me = "ben";
    expect((await edit({ id, name: "Mine now" })).status).toBe(404);
  });
});

describe("DELETE", () => {
  it("deletes a group and its member rows, and only for the owner", async () => {
    const id = (await (await create({ name: "Lab", memberIds: ["ben", "cy"] })).json()).group.id;
    expect((await remove("nope")).status).toBe(400);
    me = "ben";
    expect((await remove(id)).status).toBe(404);
    me = "ana";
    expect((await remove(id)).status).toBe(200);
    expect(await db.select().from(schema.contactGroups)).toHaveLength(0);
    expect(await db.select().from(schema.contactGroupMembers)).toHaveLength(0);
    expect((await remove(id)).status).toBe(404);
  });
});
