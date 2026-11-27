/**
 * @fileoverview `/api/practice-partners` (the board), `/profile` and `/match`
 * against a real SQLite database: what the board shows each viewer, who may
 * volunteer, and how a match is picked, tokenised and excluded on a re-roll.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { openMatchToken } from "@debate-ai/practice-rounds/src/practice-partners/match-token";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "ana";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getEnv: (name: string) => (name === "BETTER_AUTH_SECRET" ? "test-secret" : undefined),
}));

const board = await import("@/app/api/practice-partners/route");
const profileRoute = await import("@/app/api/practice-partners/profile/route");
const matchRoute = await import("@/app/api/practice-partners/match/route");

const request = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://debate-ai.com/api/practice-partners${path}`, {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const putProfile = (body: unknown) => profileRoute.PUT(request("/profile", "PUT", body));
const findMatch = (body?: unknown) => matchRoute.POST(request("/match", "POST", body));

const profileBody = (overrides: Record<string, unknown> = {}) => ({
  asCompetitor: true,
  asJudge: false,
  asCoach: false,
  seeksCoach: false,
  coachingDetails: "",
  formats: ["pf"],
  styles: [],
  speed: "conversational",
  level: "novice",
  availability: "weekends",
  note: "",
  ...overrides,
});

const seedProfile = (userId: string, overrides: Record<string, unknown> = {}, updatedAt = new Date()) =>
  db.insert(schema.practiceProfiles).values({
    userId,
    asCompetitor: Boolean(profileBody(overrides).asCompetitor),
    asJudge: Boolean(profileBody(overrides).asJudge),
    preferences: JSON.stringify(profileBody(overrides)),
    updatedAt,
  });

beforeEach(async () => {
  signedInAs = "ana";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values([
    ...["ana", "ben", "cy", "dee"].map((id) => ({ id, name: id.toUpperCase(), email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    { id: "guest", name: "Guest", email: "guest@example.com", isAnonymous: true, createdAt: now, updatedAt: now },
  ]);
});

describe("PUT /api/practice-partners/profile", () => {
  it("needs a session, a JSON body and a readable profile", async () => {
    signedInAs = null;
    expect((await putProfile(profileBody())).status).toBe(401);
    signedInAs = "ana";
    expect((await putProfile("{nope")).status).toBe(400);
    const noSpeed = await putProfile({ ...profileBody(), speed: "warp" });
    expect(noSpeed.status).toBe(400);
    expect(await noSpeed.json()).toEqual({ error: "Pick a speed you're comfortable with." });
    expect((await putProfile(profileBody({ formats: [] }))).status).toBe(400);
    expect((await putProfile(profileBody({ asCoach: true, coachingDetails: "" }))).status).toBe(400);
  });

  it("saves the profile and echoes it back, replacing an earlier one", async () => {
    const first = await putProfile(profileBody());
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ asCompetitor: true, formats: ["pf"], availability: "weekends" });

    await putProfile(profileBody({ asCompetitor: false, asJudge: true }));
    const rows = await db.select().from(schema.practiceProfiles);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "ana", asCompetitor: false, asJudge: true });
  });

  it("lets guests step back from every role but not volunteer, and rejects a vanished account", async () => {
    signedInAs = "guest";
    const volunteering = await putProfile(profileBody());
    expect(volunteering.status).toBe(403);
    expect((await putProfile(profileBody({ asCompetitor: false, formats: [] }))).status).toBe(200);
    signedInAs = "ghost";
    expect((await putProfile(profileBody())).status).toBe(401);
  });
});

describe("GET /api/practice-partners", () => {
  it("needs a signed-in, existing account", async () => {
    signedInAs = null;
    expect((await board.GET()).status).toBe(401);
    signedInAs = "ghost";
    expect((await board.GET()).status).toBe(401);
  });

  it("shows the viewer, their own profile and challenges, and the coaching board", async () => {
    await seedProfile("ana", { asCompetitor: true, asJudge: true });
    await seedProfile("ben", { asCompetitor: false, asCoach: true, coachingDetails: "LD phil", formats: ["ld"] });
    await db.insert(schema.practiceChallenges).values({
      id: "11111111-1111-4111-8111-111111111111", challengerId: "ana", opponentId: "cy", judgeId: null, judgeStatus: null,
      status: "pending", format: "pf", topic: "Resolved: a", message: "", proposedAt: null, roomId: "practice-11111111",
      createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await board.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.viewer).toMatchObject({ id: "ana", name: "ANA" });
    expect(body.profile).toMatchObject({ asCompetitor: true, asJudge: true });
    expect(body.challenges).toHaveLength(1);
    expect(body.coaching.coaches.map((c: { person: { id: string } }) => c.person.id)).toEqual(["ben"]);
    expect(body.openToJudge).toEqual([]);
  });

  it("lists accepted rounds with an empty judge seat only to volunteering judges", async () => {
    await db.insert(schema.practiceChallenges).values({
      id: "22222222-2222-4222-8222-222222222222", challengerId: "ben", opponentId: "cy", judgeId: null, judgeStatus: null,
      status: "accepted", format: "pf", topic: "Resolved: b", message: "", proposedAt: null, roomId: "practice-22222222",
      createdAt: new Date(), updatedAt: new Date(),
    });
    expect((await (await board.GET()).json()).openToJudge).toEqual([]);

    await seedProfile("ana", { asCompetitor: false, asJudge: true });
    const open = (await (await board.GET()).json()).openToJudge;
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ topic: "Resolved: b" });
  });
});

describe("POST /api/practice-partners/match", () => {
  it("needs a session, an existing non-guest account and a known format", async () => {
    signedInAs = null;
    expect((await findMatch({})).status).toBe(401);
    signedInAs = "ghost";
    expect((await findMatch({})).status).toBe(401);
    signedInAs = "guest";
    expect((await findMatch({})).status).toBe(403);
    signedInAs = "ana";
    const bad = await findMatch({ format: "nope" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Pick a format from the list." });
  });

  it("answers null when nobody is volunteering", async () => {
    await seedProfile("ana");
    expect(await (await findMatch({ format: "any" })).json()).toEqual({ match: null });
    expect(await (await findMatch()).json()).toEqual({ match: null });
  });

  it("matches a volunteer for the format with a token only the viewer can open", async () => {
    await seedProfile("ana");
    await seedProfile("ben", { formats: ["pf"] });
    await seedProfile("cy", { formats: ["ld"] });
    await seedProfile("dee", { asCompetitor: false, asJudge: true });

    const res = await findMatch({ format: "pf" });
    const { match } = await res.json();
    expect(match).toMatchObject({ formats: ["pf"], alsoJudges: false });
    expect(typeof match.score).toBe("number");

    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(await openMatchToken("test-secret", match.token, "ana", nowSeconds)).toBe("ben");
    expect(await openMatchToken("test-secret", match.token, "cy", nowSeconds)).toBeNull();
  });

  it("skips excluded tokens, people already challenged and blocked people on a re-roll", async () => {
    await seedProfile("ana");
    await seedProfile("ben");
    await seedProfile("cy");
    await seedProfile("dee");

    const first = (await (await findMatch({})).json()).match;
    const firstId = await openMatchToken("test-secret", first.token, "ana", Math.floor(Date.now() / 1000));
    const second = (await (await findMatch({ exclude: [first.token, 42] })).json()).match;
    const secondId = await openMatchToken("test-secret", second.token, "ana", Math.floor(Date.now() / 1000));
    expect(secondId).not.toBe(firstId);

    await db.insert(schema.userBlocks).values({ blockerId: "ana", blockedId: "cy", createdAt: new Date() });
    await db.insert(schema.practiceChallenges).values({
      id: "33333333-3333-4333-8333-333333333333", challengerId: "ana", opponentId: "dee", judgeId: null, judgeStatus: null,
      status: "pending", format: "pf", topic: "t", message: "", proposedAt: null, roomId: "practice-33333333",
      createdAt: new Date(), updatedAt: new Date(),
    });
    const onlyBen = (await (await findMatch({})).json()).match;
    expect(await openMatchToken("test-secret", onlyBen.token, "ana", Math.floor(Date.now() / 1000))).toBe("ben");
    expect((await (await findMatch({ exclude: [onlyBen.token] })).json()).match).toBeNull();
  });
});
