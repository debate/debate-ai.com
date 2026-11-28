/**
 * @fileoverview `/api/admin/moderators` and `/api/admin/youtube/channels`
 * against a real SQLite database, with the real admin allowlist and staff-role
 * lookup in play: only env admins manage moderators, a moderator (or admin)
 * manages the channel list, and everyone else gets a 403 before any query.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let email: string | null = null;
const env: Record<string, string | undefined> = {};
const resend = vi.hoisted(() => ({ sent: [] as Array<{ to: string; subject: string; html: string }>, fail: false }));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (email ? { user: { id: email, email, name: email }, session: {} } : null),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: { to: string; subject: string; html: string }) => {
        if (resend.fail) throw new Error("smtp down");
        resend.sent.push(message);
      },
    };
  },
}));

const moderators = await import("@/app/api/admin/moderators/route");
const channels = await import("@/app/api/admin/youtube/channels/route");

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(async () => {
  db = await freshSchemaDb();
  email = null;
  resend.sent = [];
  resend.fail = false;
  for (const key of Object.keys(env)) delete env[key];
  env.ADMIN_EMAILS = "boss@example.com";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/api/admin/moderators", () => {
  it("is closed to signed-out users, ordinary users and moderators alike", async () => {
    await db.insert(schema.staffRoles).values({ email: "mod@example.com", role: "moderator", createdAt: new Date() });
    for (const who of [null, "someone@example.com", "mod@example.com"]) {
      email = who;
      expect((await moderators.GET()).status).toBe(403);
      expect((await moderators.POST(req("/m", "POST", { email: "x@example.com" }))).status).toBe(403);
      expect((await moderators.DELETE(req("/m?email=mod@example.com", "DELETE"))).status).toBe(403);
    }
    expect(await db.select().from(schema.staffRoles)).toHaveLength(1);
  });

  it("lists the env admins and the invited moderators", async () => {
    email = "Boss@Example.com";
    await db.insert(schema.staffRoles).values(
      ["zed@example.com", "amy@example.com"].map((address) => ({ email: address, role: "moderator", createdAt: new Date() })),
    );
    const body = await (await moderators.GET()).json();
    expect(body.admins).toEqual(["boss@example.com"]);
    expect(body.moderators.map((row: { email: string }) => row.email)).toEqual(["amy@example.com", "zed@example.com"]);
  });

  it("validates the invitee", async () => {
    email = "boss@example.com";
    expect((await moderators.POST(req("/m", "POST", "{nope"))).status).toBe(400);
    expect((await moderators.POST(req("/m", "POST", {}))).status).toBe(400);
    expect((await moderators.POST(req("/m", "POST", { email: "not-an-address" }))).status).toBe(400);
    const admin = await moderators.POST(req("/m", "POST", { email: " BOSS@example.com " }));
    expect(admin.status).toBe(400);
    expect((await admin.json()).error).toBe("boss@example.com is already an admin.");
    expect(await db.select().from(schema.staffRoles)).toEqual([]);
  });

  it("notifies an invitee who already has an account in-app", async () => {
    email = "boss@example.com";
    const now = new Date();
    await db.insert(schema.user).values({ id: "u1", name: "Pat", email: "pat@example.com", createdAt: now, updatedAt: now });
    const res = await moderators.POST(req("/m", "POST", { email: " Pat@Example.com " }));
    expect(await res.json()).toEqual({ ok: true, email: "pat@example.com", delivery: "notified" });

    const [role] = await db.select().from(schema.staffRoles);
    expect(role).toMatchObject({ email: "pat@example.com", role: "moderator", invitedBy: "boss@example.com" });
    const [note] = await db.select().from(schema.notifications);
    expect(note).toMatchObject({ userId: "u1", type: "moderator_invite", link: "/admin" });
  });

  it("emails an invitee with no account when a Resend key is set, and still grants the role if sending fails", async () => {
    email = "boss@example.com";
    env.RESEND_API_KEY = "re_test";
    const sent = await moderators.POST(req("/m", "POST", { email: "new@example.com" }));
    expect((await sent.json()).delivery).toBe("emailed");
    expect(resend.sent).toHaveLength(1);
    expect(resend.sent[0]).toMatchObject({ to: "new@example.com" });
    expect(resend.sent[0].html).toContain("https://debate-ai.com/admin");

    resend.fail = true;
    const failed = await moderators.POST(req("/m", "POST", { email: "other@example.com" }));
    expect((await failed.json()).delivery).toBe("none");
    expect((await db.select().from(schema.staffRoles)).map((row) => row.email).sort()).toEqual(["new@example.com", "other@example.com"]);
  });

  it("delivers nothing (but grants the role) without a Resend key, and re-inviting is idempotent", async () => {
    email = "boss@example.com";
    for (let i = 0; i < 2; i++) {
      const res = await moderators.POST(req("/m", "POST", { email: "new@example.com" }));
      expect((await res.json()).delivery).toBe("none");
    }
    expect(await db.select().from(schema.staffRoles)).toHaveLength(1);
  });

  it("revokes a moderator, and requires an email to do so", async () => {
    email = "boss@example.com";
    await db.insert(schema.staffRoles).values({ email: "mod@example.com", role: "moderator", createdAt: new Date() });
    expect((await moderators.DELETE(req("/m", "DELETE"))).status).toBe(400);
    const res = await moderators.DELETE(req("/m?email=%20MOD@example.com", "DELETE"));
    expect(await res.json()).toEqual({ ok: true, email: "mod@example.com" });
    expect(await db.select().from(schema.staffRoles)).toEqual([]);
  });

  it("answers 500 with the database's reason when a query fails", async () => {
    email = "boss@example.com";
    db = { select: () => { throw new Error("d1 down"); }, insert: () => { throw new Error("d1 down"); }, delete: () => { throw new Error("d1 down"); } } as unknown as Db;
    for (const res of [
      await moderators.GET(),
      await moderators.POST(req("/m", "POST", { email: "new@example.com" })),
      await moderators.DELETE(req("/m?email=new@example.com", "DELETE")),
    ]) {
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).toContain("d1 down");
    }
  });
});

describe("/api/admin/youtube/channels", () => {
  const asModerator = async () => {
    await db.insert(schema.staffRoles).values({ email: "mod@example.com", role: "moderator", createdAt: new Date() });
    email = "mod@example.com";
  };

  it("is closed to anyone who cannot edit content", async () => {
    for (const who of [null, "someone@example.com"]) {
      email = who;
      expect((await channels.GET()).status).toBe(403);
      expect((await channels.POST(req("/c", "POST", { name: "Speech Club" }))).status).toBe(403);
      expect((await channels.PATCH(req("/c?id=1", "PATCH", { enabled: false }))).status).toBe(403);
      expect((await channels.DELETE(req("/c?id=1", "DELETE"))).status).toBe(403);
    }
  });

  it("lets a moderator add, rename, pause and delete a channel", async () => {
    await asModerator();
    const added = await channels.POST(req("/c", "POST", { name: "  Speech Club  " }));
    expect(added.status).toBe(201);
    const { channel } = await added.json();
    expect(channel).toMatchObject({ name: "Speech Club", enabled: true, addedBy: "mod@example.com" });

    const renamed = await channels.PATCH(req(`/c?id=${channel.id}`, "PATCH", { name: "Debate Club", enabled: false }));
    expect((await renamed.json()).channel).toMatchObject({ name: "Debate Club", enabled: false });

    const listed = await (await channels.GET()).json();
    expect(JSON.stringify(listed)).toContain("Debate Club");

    expect(await (await channels.DELETE(req(`/c?id=${channel.id}`, "DELETE"))).json()).toEqual({ deleted: true });
    expect(await db.select().from(schema.youtubeChannels)).toEqual([]);
  });

  it("answers 400 for a bad id or body, and 409 for a blank name or a name already taken", async () => {
    await asModerator();
    expect((await channels.POST(req("/c", "POST", "{nope"))).status).toBe(400);
    expect((await channels.PATCH(req("/c", "PATCH", { enabled: true }))).status).toBe(400);
    expect((await channels.PATCH(req("/c?id=-3", "PATCH", { enabled: true }))).status).toBe(400);
    expect((await channels.PATCH(req("/c?id=1", "PATCH", "{nope"))).status).toBe(400);
    expect((await channels.DELETE(req("/c?id=abc", "DELETE"))).status).toBe(400);

    const blank = await channels.POST(req("/c", "POST", { name: "   " }));
    expect(blank.status).toBe(409);
    expect((await blank.json()).error).toBe("Channel name is required.");

    const a = (await (await channels.POST(req("/c", "POST", { name: "A" }))).json()).channel;
    await channels.POST(req("/c", "POST", { name: "B" }));
    const clash = await channels.PATCH(req(`/c?id=${a.id}`, "PATCH", { name: "B" }));
    expect(clash.status).toBe(409);
    expect((await clash.json()).error).toBe("Another channel already uses that name.");
  });

  it("re-enables a paused channel when its name is added again", async () => {
    email = "boss@example.com";
    const { channel } = await (await channels.POST(req("/c", "POST", { name: "Speech Club" }))).json();
    await channels.PATCH(req(`/c?id=${channel.id}`, "PATCH", { enabled: false }));
    const again = await channels.POST(req("/c", "POST", { name: "Speech Club" }));
    expect((await again.json()).channel).toMatchObject({ id: channel.id, enabled: true });
    expect(await db.select().from(schema.youtubeChannels)).toHaveLength(1);
  });
});
