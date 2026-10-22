/**
 * @fileoverview The admin routes for staff and accounts: `me`, `overview`,
 * `moderators` and the user directory, run against a real in-memory database
 * with the real admin allowlist and moderator grants deciding access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifications, session, staffRoles, user } from "@/lib/database/schema";
import { ADMIN, MODERATOR, access } from "./helpers/access";
import { freshDb, params, request, type DB } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import("./helpers/access")).contextMock,
}));

const resend = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resend.send };
  },
}));

const me = await import("../src/api/admin/me");
const overview = await import("../src/api/admin/overview");
const moderators = await import("../src/api/admin/moderators");
const users = await import("../src/api/admin/users/index");
const userById = await import("../src/api/admin/users/[id]/index");

const now = new Date("2026-09-01T00:00:00Z");
let db: DB;

async function seedUser(id: string, email = `${id}@example.com`, createdAt = now) {
  await db.insert(user).values({ id, name: `User ${id}`, email, createdAt, updatedAt: createdAt });
}

beforeEach(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("AUTH_RESEND_KEY", "");
  db = await freshDb();
  access.db = db;
  access.email = ADMIN;
  resend.send.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/admin/me", () => {
  it("reports an admin", async () => {
    const res = await me.GET();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.json()).toEqual({ role: "admin", isAdmin: true, isModerator: false, canEditContent: true });
  });

  it("reports a moderator from staff_roles", async () => {
    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: now });
    access.email = MODERATOR;
    expect(await (await me.GET()).json()).toEqual({
      role: "moderator",
      isAdmin: false,
      isModerator: true,
      canEditContent: true,
    });
  });

  it("reports nobody when signed out", async () => {
    access.email = null;
    expect(await (await me.GET()).json()).toEqual({
      role: null,
      isAdmin: false,
      isModerator: false,
      canEditContent: false,
    });
  });
});

describe("GET /api/admin/overview", () => {
  it("counts rows and lists the newest accounts first", async () => {
    await seedUser("old", "old@example.com", new Date("2026-01-01"));
    await seedUser("new", "new@example.com", new Date("2026-06-01"));
    await db.insert(session).values({
      id: "s1",
      token: "t1",
      userId: "new",
      expiresAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const body = await (await overview.GET()).json();
    expect(body.stats).toEqual({ users: 2, sessions: 1, files: 0, publishedVideos: 0, stagedVideos: 0 });
    expect(body.recentUsers.map((row: { id: string }) => row.id)).toEqual(["new", "old"]);
    // No session tokens in the payload.
    expect(JSON.stringify(body)).not.toContain("t1");
  });

  it("is admin-only", async () => {
    access.email = MODERATOR;
    expect((await overview.GET()).status).toBe(403);
  });
});

describe("/api/admin/moderators", () => {
  const invite = (body: unknown) => moderators.POST(request("/api/admin/moderators", { method: "POST", body }));

  it("lists env admins and invited moderators", async () => {
    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: now });
    const body = await (await moderators.GET()).json();
    expect(body.admins).toEqual([ADMIN]);
    expect(body.moderators.map((row: { email: string }) => row.email)).toEqual([MODERATOR]);
  });

  it("notifies an invitee who already has an account", async () => {
    await seedUser("m", MODERATOR);
    const res = await invite({ email: "  Mod@Example.com " });
    expect(await res.json()).toEqual({ ok: true, email: MODERATOR, delivery: "notified" });
    const [grant] = await db.select().from(staffRoles);
    expect(grant).toMatchObject({ email: MODERATOR, role: "moderator", invitedBy: ADMIN });
    const [notice] = await db.select().from(notifications);
    expect(notice).toMatchObject({ userId: "m", type: "moderator_invite", link: "/admin" });
  });

  it("emails an invitee without an account when Resend is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resend.send.mockResolvedValue({ id: "e1" });
    const res = await invite({ email: MODERATOR });
    expect(await res.json()).toMatchObject({ delivery: "emailed" });
    expect(resend.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: MODERATOR, html: expect.stringContaining("http://localhost/admin") }),
    );
  });

  it("still grants the role when the invite email fails", async () => {
    vi.stubEnv("AUTH_RESEND_KEY", "re_test");
    resend.send.mockRejectedValue(new Error("down"));
    expect(await (await invite({ email: MODERATOR })).json()).toMatchObject({ ok: true, delivery: "none" });
    expect(await db.select().from(staffRoles)).toHaveLength(1);
  });

  it("logs the invite in development without Resend", async () => {
    expect(await (await invite({ email: MODERATOR })).json()).toMatchObject({ delivery: "none" });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(MODERATOR));
  });

  it.each([
    ["not JSON", "{", "Invalid JSON body"],
    ["an invalid address", { email: "nope" }, "Provide a valid email address."],
    ["an admin's address", { email: ADMIN }, `${ADMIN} is already an admin.`],
  ])("rejects %s", async (_label, body, error) => {
    const res = await invite(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it("revokes a moderator", async () => {
    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: now });
    const res = await moderators.DELETE(
      request(`/api/admin/moderators?email=${encodeURIComponent(" MOD@example.com")}`, { method: "DELETE" }),
    );
    expect(await res.json()).toEqual({ ok: true, email: MODERATOR });
    expect(await db.select().from(staffRoles)).toEqual([]);
  });

  it("needs an email to revoke", async () => {
    expect((await moderators.DELETE(request("/api/admin/moderators", { method: "DELETE" }))).status).toBe(400);
  });

  it("is admin-only, even for moderators", async () => {
    await db.insert(staffRoles).values({ email: MODERATOR, role: "moderator", createdAt: now });
    access.email = MODERATOR;
    expect((await moderators.GET()).status).toBe(403);
    expect((await invite({ email: "x@example.com" })).status).toBe(403);
    expect((await moderators.DELETE(request("/api/admin/moderators?email=a@b.co", { method: "DELETE" }))).status).toBe(403);
  });

  it("answers 500 with details when the database fails", async () => {
    access.db = {
      select: () => {
        throw new Error("no such table: staff_roles");
      },
      insert: () => {
        throw new Error("read only");
      },
      delete: () => {
        throw new Error("read only");
      },
    };
    expect((await moderators.GET()).status).toBe(500);
    expect((await invite({ email: MODERATOR })).status).toBe(500);
    const res = await moderators.DELETE(request(`/api/admin/moderators?email=${MODERATOR}`, { method: "DELETE" }));
    expect(res.status).toBe(500);
    expect((await res.json()).details).toContain("read only");
  });
});

describe("/api/admin/users", () => {
  it("pages the directory with clamped limits", async () => {
    for (let index = 0; index < 3; index++) await seedUser(`u${index}`);
    const res = await users.GET(request("/api/admin/users?limit=2&page=0"));
    const body = await res.json();
    expect(body).toMatchObject({ page: 1, limit: 2, pageCount: 2, matchedUsers: 3 });
    expect(body.users).toHaveLength(2);
    expect(body.totals).toBeDefined();
  });

  it("searches by name or email", async () => {
    await seedUser("alice");
    await seedUser("bob");
    const body = await (await users.GET(request("/api/admin/users?q=alice&sort=name&dir=asc"))).json();
    expect(body.users.map((row: { id: string }) => row.id)).toEqual(["alice"]);
  });

  it("returns one user's usage, or 404", async () => {
    await seedUser("alice");
    const res = await userById.GET(request("/api/admin/users/alice"), params({ id: "alice" }));
    expect(await res.json()).toMatchObject({ id: "alice", email: "alice@example.com" });
    expect((await userById.GET(request("/api/admin/users/x"), params({ id: "x" }))).status).toBe(404);
  });

  it("is admin-only", async () => {
    access.email = "someone@example.com";
    expect((await users.GET(request("/api/admin/users"))).status).toBe(403);
    expect((await userById.GET(request("/api/admin/users/a"), params({ id: "a" }))).status).toBe(403);
  });
});
