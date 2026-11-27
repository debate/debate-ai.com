/**
 * @fileoverview `/api/organizations/members` against a real SQLite database:
 * who sees the member list and the contacts they could add, and the checks on
 * adding a member (owner/admin only, own contacts only, no blocks).
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let session: { user: { id: string }; session: { activeOrganizationId: string | null } } | null;
const addMember = vi.fn();

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));
vi.mock("@/lib/auth", () => ({ getAuth: async () => ({ api: { addMember } }) }));

const route = await import("@/app/api/organizations/members/route");

const signIn = (userId: string | null, activeOrganizationId: string | null = "org1") => {
  session = userId ? { user: { id: userId }, session: { activeOrganizationId } } : null;
};
const post = (body: unknown) =>
  route.POST(
    new NextRequest("https://debate-ai.com/api/organizations/members", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("/api/organizations/members", () => {
  beforeEach(async () => {
    addMember.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["owner", "mem", "friend", "stranger", "blocked"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    );
    await db.insert(schema.organization).values({ id: "org1", name: "Lincoln High", slug: "lincoln", createdAt: now });
    await db.insert(schema.member).values([
      { id: "m1", organizationId: "org1", userId: "owner", role: "owner", createdAt: now },
      { id: "m2", organizationId: "org1", userId: "mem", role: "member", createdAt: now },
    ]);
    await db.insert(schema.contacts).values([
      { requesterId: "owner", addresseeId: "friend", status: "accepted" },
      { requesterId: "blocked", addresseeId: "owner", status: "accepted" },
      { requesterId: "stranger", addresseeId: "owner", status: "pending" },
      { requesterId: "mem", addresseeId: "owner", status: "accepted" },
    ]);
    await db.insert(schema.userBlocks).values({ blockerId: "owner", blockedId: "blocked", createdAt: now });
    signIn("owner");
  });

  describe("GET", () => {
    it("needs a session and an active organization the caller belongs to", async () => {
      signIn(null);
      expect((await route.GET()).status).toBe(401);
      signIn("owner", null);
      const none = await route.GET();
      expect(none.status).toBe(400);
      expect(await none.json()).toEqual({ error: "Switch to an organization first." });
      signIn("friend");
      expect((await route.GET()).status).toBe(400);
    });

    it("shows an owner the members and the accepted, unblocked contacts they could add", async () => {
      const res = await route.GET();
      const body = await res.json();
      expect(body.organization).toEqual({ id: "org1", name: "Lincoln High", role: "owner" });
      expect(body.members.map((m: { id: string }) => m.id).sort()).toEqual(["mem", "owner"]);
      expect(body.candidates.map((c: { id: string }) => c.id)).toEqual(["friend"]);
    });

    it("hides candidates from plain members", async () => {
      signIn("mem");
      const body = await (await route.GET()).json();
      expect(body.organization.role).toBe("member");
      expect(body.candidates).toEqual([]);
    });
  });

  describe("POST", () => {
    it("needs a session, JSON and a user id", async () => {
      signIn(null);
      expect((await post({ userId: "friend" })).status).toBe(401);
      signIn("owner");
      expect((await post("{nope")).status).toBe(400);
      expect((await post(null)).status).toBe(400);
      expect((await post({ userId: "  " })).status).toBe(400);
      expect((await post({ userId: 7 })).status).toBe(400);
    });

    it("needs an active organization, and only owners and admins may add", async () => {
      signIn("owner", null);
      expect((await post({ userId: "friend" })).status).toBe(400);
      signIn("mem");
      const res = await post({ userId: "friend" });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Only an owner or admin can add members." });
      expect(addMember).not.toHaveBeenCalled();
    });

    it("reports someone already in the organization without adding them again", async () => {
      expect(await (await post({ userId: "mem" })).json()).toEqual({ status: "already-member" });
      expect(addMember).not.toHaveBeenCalled();
    });

    it("only adds the caller's own contacts, never blocked or pending ones", async () => {
      for (const userId of ["stranger", "blocked", "nobody"]) {
        const res = await post({ userId });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "You can only add your own contacts." });
      }
      expect(addMember).not.toHaveBeenCalled();
    });

    it("adds a contact as a member through the auth API", async () => {
      addMember.mockResolvedValueOnce({});
      expect(await (await post({ userId: "friend" })).json()).toEqual({ status: "added" });
      expect(addMember).toHaveBeenCalledWith({ body: { userId: "friend", organizationId: "org1", role: "member" } });
    });

    it("answers 500 when the auth API refuses", async () => {
      addMember.mockRejectedValueOnce(new Error("nope"));
      const res = await post({ userId: "friend" });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Failed to add that member." });
    });
  });
});
