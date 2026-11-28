/**
 * @fileoverview The school-claim and school-page routes against a real SQLite
 * database: a claim needs a session, a school address sends a code and an
 * unsendable one withdraws the claim, and only a school's owners (or staff)
 * may change its page and roster.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshSchemaDb } from "@/lib/database/__tests__/schema-sql";
import * as schema from "@/lib/database/schema";
import { createClaim, reviewClaim } from "@/lib/school-claims/queries";

type Db = Awaited<ReturnType<typeof freshSchemaDb>>;

let db: Db;
let signedInAs: { id: string; name: string; email: string } | null = null;
const env: Record<string, string | undefined> = {};
const resend = vi.hoisted(() => ({ sent: [] as Array<{ to: string; subject: string }>, fail: false }));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => undefined }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => env[key] }));
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => (signedInAs ? { user: signedInAs, session: {} } : null),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: { to: string; subject: string }) => {
        if (resend.fail) throw new Error("smtp down");
        resend.sent.push(message);
      },
    };
  },
}));

const claims = await import("@/app/api/school-claims/route");
const oneClaim = await import("@/app/api/school-claims/[id]/route");
const school = await import("@/app/api/schools/[slug]/route");
const members = await import("@/app/api/schools/[slug]/members/route");

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

async function addUser(id: string, email = `${id}@example.test`) {
  const now = new Date();
  await db.insert(schema.user).values({ id, name: `User ${id}`, email, createdAt: now, updatedAt: now });
}
const login = (id: string, email = `${id}@example.test`) => (signedInAs = { id, name: `User ${id}`, email });

const harker = { schoolName: "Harker", schoolSlug: "harker", isNewSchool: false, role: "coach" as const };

beforeEach(async () => {
  db = await freshSchemaDb();
  signedInAs = null;
  resend.sent = [];
  resend.fail = false;
  for (const key of Object.keys(env)) delete env[key];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  await addUser("owner");
  await addUser("stranger");
  await addUser("mod", "mod@example.test");
});

async function approvedOwner(userId = "owner") {
  const { claim } = await createClaim(db as never, { userId, ...harker, schoolEmail: null, explanation: "I coach the team there." });
  await reviewClaim(db as never, { id: claim.id, decision: "approve", note: null, reviewer: "admin@example.test" });
}

describe("/api/school-claims", () => {
  it("answers a signed-out GET with an empty, signedIn:false shape", async () => {
    const res = await claims.GET(json("/api/school-claims", "GET"), undefined as never);
    expect(await res.json()).toEqual({ signedIn: false, claims: [], ownedSchools: [] });
  });

  it("lists the signed-in user's own claims only", async () => {
    await createClaim(db as never, { userId: "owner", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    login("stranger");
    const none = await (await claims.GET(json("/api/school-claims", "GET"), undefined as never)).json();
    expect(none).toMatchObject({ signedIn: true, claims: [] });

    login("owner");
    const mine = await (await claims.GET(json("/api/school-claims", "GET"), undefined as never)).json();
    expect(mine.claims).toHaveLength(1);
    expect(mine.claims[0]).toMatchObject({ schoolSlug: "harker", status: "pending" });
  });

  it("requires a session and a valid body to file a claim", async () => {
    expect((await claims.POST(json("/api/school-claims", "POST", harker), undefined as never)).status).toBe(401);
    login("owner");
    const bad = await claims.POST(json("/api/school-claims", "POST", "{nope"), undefined as never);
    expect(bad.status).toBe(400);
    expect(typeof (await bad.json()).error).toBe("string");
  });

  it("sends an explanation-only claim straight to the moderators, who are pinged in-app", async () => {
    env.ADMIN_EMAILS = "mod@example.test";
    login("owner");
    const res = await claims.POST(
      json("/api/school-claims", "POST", { schoolName: "Harker", isNewSchool: false, role: "coach", explanation: "I coach the team there." }),
      undefined as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delivery).toBeNull();
    expect(body.claim).toMatchObject({ schoolName: "Harker", status: "pending" });

    const notes = await db.select().from(schema.notifications);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ userId: "mod", type: "school_claim", link: "/admin#schools" });
    expect(notes[0].body).toContain("User owner says they are the coach of Harker");
  });

  it("emails a code to the school address, logging it when no Resend key is set", async () => {
    login("owner");
    const body = { schoolName: "Harker", isNewSchool: false, role: "admin", schoolEmail: "coach@harker.org" };
    const logged = await (await claims.POST(json("/api/school-claims", "POST", body), undefined as never)).json();
    expect(logged.delivery).toBe("logged");
    expect(logged.claim.status).toBe("awaiting_email");
    expect(resend.sent).toEqual([]);

    await db.delete(schema.schoolClaims);
    env.RESEND_API_KEY = "re_test";
    const emailed = await (await claims.POST(json("/api/school-claims", "POST", body), undefined as never)).json();
    expect(emailed.delivery).toBe("emailed");
    expect(resend.sent).toHaveLength(1);
    expect(resend.sent[0]).toMatchObject({ to: "coach@harker.org" });
    expect(resend.sent[0].subject).toMatch(/school verification code: \d{6}$/);
  });

  it("withdraws the claim and answers 502 when the code cannot be emailed", async () => {
    login("owner");
    env.RESEND_API_KEY = "re_test";
    resend.fail = true;
    const res = await claims.POST(
      json("/api/school-claims", "POST", { schoolName: "Harker", isNewSchool: false, role: "coach", schoolEmail: "coach@harker.org" }),
      undefined as never,
    );
    expect(res.status).toBe(502);
    expect(await db.select().from(schema.schoolClaims)).toEqual([]);
  });

  it("turns a refused duplicate claim into the query's status", async () => {
    login("owner");
    const body = { schoolName: "Harker", isNewSchool: false, role: "coach", explanation: "I coach the team there." };
    expect((await claims.POST(json("/api/school-claims", "POST", body), undefined as never)).status).toBe(200);
    const again = await claims.POST(json("/api/school-claims", "POST", body), undefined as never);
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect((await again.json()).error).toContain("already have a claim");
  });
});

describe("/api/school-claims/[id]", () => {
  it("requires a session for every method", async () => {
    expect((await oneClaim.PATCH(json("/x", "PATCH", { action: "resend" }), idCtx("c"))).status).toBe(401);
    expect((await oneClaim.DELETE(json("/x", "DELETE"), idCtx("c"))).status).toBe(401);
  });

  it("verifies the emailed code, rejecting malformed and wrong ones", async () => {
    login("owner");
    const { claim, code } = await createClaim(db as never, { userId: "owner", ...harker, schoolEmail: "c@harker.org", explanation: null });

    const malformed = await oneClaim.PATCH(json("/x", "PATCH", { action: "verify", code: "12" }), idCtx(claim.id));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe("Enter the six-digit code.");

    const wrong = await oneClaim.PATCH(json("/x", "PATCH", { action: "verify", code: code === "000000" ? "111111" : "000000" }), idCtx(claim.id));
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const ok = await oneClaim.PATCH(json("/x", "PATCH", { action: "verify", code }), idCtx(claim.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).claim).toMatchObject({ status: "pending", emailVerified: true });
  });

  it("resends a fresh code to the claim's address", async () => {
    login("owner");
    env.RESEND_API_KEY = "re_test";
    const { claim } = await createClaim(db as never, { userId: "owner", ...harker, schoolEmail: "c@harker.org", explanation: null });
    const res = await oneClaim.PATCH(json("/x", "PATCH", { action: "resend" }), idCtx(claim.id));
    expect(res.status).toBe(200);
    expect(resend.sent).toEqual([expect.objectContaining({ to: "c@harker.org" })]);
  });

  it("rejects an unknown action or a body that is not JSON", async () => {
    login("owner");
    const unknown = await oneClaim.PATCH(json("/x", "PATCH", { action: "approve" }), idCtx("c"));
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toBe('action must be "verify" or "resend".');
    expect((await oneClaim.PATCH(json("/x", "PATCH", "{nope"), idCtx("c"))).status).toBe(400);
  });

  it("keeps one user from touching another's claim", async () => {
    const { claim } = await createClaim(db as never, { userId: "owner", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    login("stranger");
    const res = await oneClaim.DELETE(json("/x", "DELETE"), idCtx(claim.id));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(schema.schoolClaims)).toHaveLength(1);
  });

  it("lets a claimant withdraw an open claim", async () => {
    const { claim } = await createClaim(db as never, { userId: "owner", ...harker, schoolEmail: null, explanation: "I coach the team there." });
    login("owner");
    const res = await oneClaim.DELETE(json("/x", "DELETE"), idCtx(claim.id));
    expect(await res.json()).toEqual({ ok: true });
    expect(await db.select().from(schema.schoolClaims)).toEqual([]);
  });
});

describe("/api/schools/[slug]", () => {
  it("refuses a segment that is not a profile slug", async () => {
    expect((await school.GET(json("/x", "GET"), slugCtx("Not A Slug!"))).status).toBe(400);
    expect((await school.PATCH(json("/x", "PATCH", { logo: null }), slugCtx("Not A Slug!"))).status).toBe(400);
  });

  it("serves the page signed out, without management rights", async () => {
    await approvedOwner();
    const body = await (await school.GET(json("/x", "GET"), slugCtx("harker"))).json();
    expect(body).toMatchObject({ name: "Harker", canManage: false });
  });

  it("only lets owners or staff change the page", async () => {
    await approvedOwner();
    login("stranger");
    const denied = await school.PATCH(json("/x", "PATCH", { logo: null }), slugCtx("harker"));
    expect(denied.status).toBe(403);

    login("owner");
    const own = await school.GET(json("/x", "GET"), slugCtx("harker"));
    expect((await own.json()).canManage).toBe(true);

    env.ADMIN_EMAILS = "mod@example.test";
    login("mod", "mod@example.test");
    const staff = await school.PATCH(json("/x", "PATCH", { logo: null }), slugCtx("harker"));
    expect(staff.status).toBe(200);
  });

  it("validates and stores the logo", async () => {
    await approvedOwner();
    login("owner");
    const bad = await school.PATCH(json("/x", "PATCH", { logo: "https://evil.example/x.png" }), slugCtx("harker"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/PNG, JPEG, WebP or GIF/);

    const png = "data:image/png;base64,iVBORw0KGgo=";
    const ok = await school.PATCH(json("/x", "PATCH", { logo: png }), slugCtx("harker"));
    expect((await ok.json()).logo).toBe(png);
    const cleared = await school.PATCH(json("/x", "PATCH", { logo: null }), slugCtx("harker"));
    expect((await cleared.json()).logo).toBeNull();
  });

  it("sets and clears the school's location, and refuses a bad state code", async () => {
    await approvedOwner();
    login("owner");
    const set = await school.PATCH(json("/x", "PATCH", { city: "  San Jose  ", state: "ca" }), slugCtx("harker"));
    expect(await set.json()).toMatchObject({ city: "San Jose", state: "CA" });

    const bad = await school.PATCH(json("/x", "PATCH", { city: "San Jose", state: "Narnia" }), slugCtx("harker"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/two-letter US state/);

    const cleared = await school.PATCH(json("/x", "PATCH", { city: "", state: null }), slugCtx("harker"));
    expect(await cleared.json()).toMatchObject({ city: null, state: null });
  });

  it("asks for a logo or a location when given neither", async () => {
    await approvedOwner();
    login("owner");
    expect((await school.PATCH(json("/x", "PATCH", {}), slugCtx("harker"))).status).toBe(400);
    expect((await school.PATCH(json("/x", "PATCH", "{nope"), slugCtx("harker"))).status).toBe(400);
  });
});

describe("/api/schools/[slug]/members", () => {
  it("is closed to anyone who does not own the school", async () => {
    await approvedOwner();
    const signedOut = await members.POST(json("/x", "POST", { kind: "team", name: "Lee & Lin" }), slugCtx("harker"));
    expect(signedOut.status).toBe(403);
    login("stranger");
    expect((await members.POST(json("/x", "POST", { kind: "team", name: "Lee & Lin" }), slugCtx("harker"))).status).toBe(403);
    expect((await members.DELETE(json("/x?id=1", "DELETE"), slugCtx("harker"))).status).toBe(403);
    expect((await members.POST(json("/x", "POST", {}), slugCtx("not a slug"))).status).toBe(400);
  });

  it("adds a team and a student to the roster, then removes one", async () => {
    await approvedOwner();
    login("owner");
    await members.POST(json("/x", "POST", { kind: "team", name: "Lee & Lin" }), slugCtx("harker"));
    const page = await (
      await members.POST(json("/x", "POST", { kind: "student", name: "Ana", email: "ana@harker.org" }), slugCtx("harker"))
    ).json();
    expect(page.members.map((m: { kind: string; name: string; email: string | null }) => [m.kind, m.name, m.email])).toEqual([
      ["student", "Ana", "ana@harker.org"],
      ["team", "Lee & Lin", null],
    ]);

    const team = page.members.find((m: { kind: string }) => m.kind === "team");
    const afterRemoval = await (await members.DELETE(json(`/x?id=${team.id}`, "DELETE"), slugCtx("harker"))).json();
    expect(afterRemoval.members.map((m: { name: string }) => m.name)).toEqual(["Ana"]);
  });

  it("validates the member body and requires an id to delete", async () => {
    await approvedOwner();
    login("owner");
    expect((await members.POST(json("/x", "POST", { kind: "robot", name: "R2" }), slugCtx("harker"))).status).toBe(400);
    expect((await members.POST(json("/x", "POST", "{nope"), slugCtx("harker"))).status).toBe(400);
    const missing = await members.DELETE(json("/x", "DELETE"), slugCtx("harker"));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("Provide ?id=");
  });
});
