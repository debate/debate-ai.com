/**
 * @fileoverview `/api/judge-paradigms` and `/api/admin/judge-paradigms`
 * against a real SQLite database, with Tabroom's API stubbed: the judge
 * dialog's profile (fetched once, then cached), a judge writing and verifying
 * their own paradigm, and the admin sync's discovery walk.
 */

import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "judge";
let isAdmin = false;
let token: string | undefined = "site-session";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getAdminAccess: async () => ({ isAdmin, email: isAdmin ? "admin@example.com" : null }) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => (key === "TABROOM_SESSION_TOKEN" ? token : undefined) }));

const profileRoute = await import("@/app/api/judge-paradigms/route");
const meRoute = await import("@/app/api/judge-paradigms/me/route");
const verifyRoute = await import("@/app/api/judge-paradigms/me/verify/route");
const adminRoute = await import("@/app/api/admin/judge-paradigms/route");

/** Tabroom's paradigm text per person id; the stubbed API serves it. */
const paradigms = new Map<number, string>([[777, "<p>Tech over truth.</p>"]]);
const tabroom = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(String(input));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  if (url.pathname === "/v1/rest/paradigms") {
    const offset = Number(url.searchParams.get("offset"));
    return json(offset === 0 ? [{ id: 777, name: "Sam Lee", tournJudged: 4 }, { id: 778, name: "Ann Yu", tournJudged: 1 }] : []);
  }
  const match = /^\/v1\/rest\/paradigms\/(\d+)(\/record)?$/.exec(url.pathname);
  const id = Number(match?.[1]);
  if (match?.[2]) return json([{ Tourn: { id: 1, name: "Blake" }, vote: "Aff", panelVote: "Aff", record: "1-0", affLabel: "Aff", negLabel: "Neg" }]);
  if (!paradigms.has(id)) return json({ title: "Not Found" }, 404);
  return json({ id, name: id === 777 ? "Sam Lee" : "Ann Yu", paradigm: paradigms.get(id), lastReviewed: null });
});

async function call<T>(userId: string | null, run: () => Promise<Response>): Promise<{ status: number; body: T }> {
  signedInAs = userId;
  const res = await run();
  return { status: res.status, body: (await res.json()) as T };
}
const req = (path: string, init?: RequestInit) => new Request(`https://d.ebate.app${path}`, init) as never;
const getProfile = (query: string) => call<Record<string, any>>(null, () => profileRoute.GET(req(`/api/judge-paradigms?${query}`)));

describe("judge paradigms", () => {
  beforeEach(async () => {
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(["judge", "other"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    tabroom.mockClear();
    vi.stubGlobal("fetch", tabroom);
    token = "site-session";
    isAdmin = false;
    paradigms.set(777, "<p>Tech over truth.</p>");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a judge from Tabroom once, then serves the cached copy", async () => {
    const first = await getProfile("personId=777");
    expect(first.status).toBe(200);
    expect(first.body.profile).toMatchObject({ personId: 777, name: "Sam Lee", paradigmHtml: "<p>Tech over truth.</p>", record: [expect.objectContaining({ vote: "Aff" })] });
    expect(new Headers((tabroom.mock.calls[0][1] as RequestInit).headers).get("cookie")).toBe("TabroomToken=site-session");

    const calls = tabroom.mock.calls.length;
    // Found by name from the cache now.
    expect((await getProfile("first=Sam&last=Lee")).body.profile).toMatchObject({ personId: 777 });
    expect(tabroom.mock.calls.length).toBe(calls);
  });

  it("says why when the site has no Tabroom session", async () => {
    token = undefined;
    const { body } = await getProfile("personId=777");
    expect(body.profile).toMatchObject({ personId: 777, record: [], note: expect.stringContaining("sign-in") });
    expect(tabroom).not.toHaveBeenCalled();
  });

  it("rejects a request with neither id nor name", async () => {
    expect((await getProfile("first=Sam")).status).toBe(400);
  });

  it("lets a judge write a paradigm that shows once verified by the code on Tabroom", async () => {
    expect((await call(null, () => meRoute.GET())).status).toBe(401);
    const blank = await call<Record<string, any>>("judge", () => meRoute.GET());
    expect(blank.body).toMatchObject({ markdown: "", verified: false, verifyCode: expect.stringMatching(/^debate-ai-[0-9a-f]{10}$/) });

    const saved = await call<Record<string, any>>("judge", () =>
      meRoute.PUT(req("/api/judge-paradigms/me", { method: "PUT", body: JSON.stringify({ tabroomPersonId: "judge_person_id=777", markdown: "## Speed\nFine. <img src=x onerror=alert(1)>" }) })),
    );
    expect(saved.body).toMatchObject({ tabroomPersonId: 777, verified: false });
    expect(saved.body.html).toContain("<h2>Speed</h2>");
    expect(saved.body.html).not.toContain("<img");

    // Not verified: the dialog still shows Tabroom's paradigm.
    expect((await getProfile("personId=777")).body.profile.ownParadigm).toBeNull();

    const refused = await call<Record<string, any>>("judge", () => verifyRoute.POST());
    expect(refused.status).toBe(409);

    paradigms.set(777, `<p>Tech over truth. ${blank.body.verifyCode}</p>`);
    const verified = await call<Record<string, any>>("judge", () => verifyRoute.POST());
    expect(verified.body).toMatchObject({ verified: true });
    expect((await getProfile("personId=777")).body.profile.ownParadigm.html).toContain("<h2>Speed</h2>");

    // Linking a different judge clears the verification.
    const moved = await call<Record<string, any>>("judge", () =>
      meRoute.PUT(req("/api/judge-paradigms/me", { method: "PUT", body: JSON.stringify({ tabroomPersonId: 778, markdown: "x" }) })),
    );
    expect(moved.body.verified).toBe(false);
  });

  it("lets admins sync every paradigm and verify claims", async () => {
    expect((await call(null, () => adminRoute.GET())).status).toBe(403);
    isAdmin = true;

    const batch = await call<Record<string, any>>(null, () => adminRoute.POST(req("/api/admin/judge-paradigms", { method: "POST", body: JSON.stringify({ mode: "discover" }) })));
    expect(batch.body).toMatchObject({ mode: "discover", fetched: 2, saved: 2, nextOffset: null });

    await call("other", () => meRoute.PUT(req("/api/judge-paradigms/me", { method: "PUT", body: JSON.stringify({ tabroomPersonId: 778, markdown: "Mine" }) })));
    const status = await call<Record<string, any>>(null, () => adminRoute.GET());
    expect(status.body).toMatchObject({ credentialsConfigured: true, cached: 2, discoveryDone: true });
    expect(status.body.claims).toEqual([expect.objectContaining({ userId: "other", tabroomPersonId: 778, tabroomName: "Ann Yu", verified: false })]);

    const decided = await call(null, () => adminRoute.PATCH(req("/api/admin/judge-paradigms", { method: "PATCH", body: JSON.stringify({ userId: "other", verified: true }) })));
    expect(decided.status).toBe(200);
    expect((await getProfile("personId=778")).body.profile.ownParadigm.html).toContain("Mine");
  });
});
