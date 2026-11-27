/**
 * @fileoverview `/api/practice-partners/challenges` (POST) and
 * `/challenges/[challengeId]` (PATCH) against a real SQLite database: the
 * checks that stop someone challenging a blocked, closed or guest account, the
 * pending-challenge cap, match-token redemption, notifications to the people
 * involved, and the actions each participant may take.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { sealMatchToken } from "@debate-ai/practice-rounds/src/practice-partners/match-token";
import { MAX_PENDING_OUTGOING } from "@debate-ai/practice-rounds/src/practice-partners/types";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "ana";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getEnv: (name: string) => (name === "BETTER_AUTH_SECRET" ? "test-secret" : undefined),
}));

const challenges = await import("@/app/api/practice-partners/challenges/route");
const challengeById = await import("@/app/api/practice-partners/challenges/[challengeId]/route");

const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const volunteer = JSON.stringify({ formats: ["pf"] });

const post = (body: unknown) =>
  challenges.POST(
    new NextRequest("https://debate-ai.com/api/practice-partners/challenges", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const patch = (id: string, body: unknown) =>
  challengeById.PATCH(
    new NextRequest(`https://debate-ai.com/api/practice-partners/challenges/${id}`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ challengeId: id }) },
  );

const validChallenge = (overrides: Record<string, unknown> = {}) => ({
  opponentId: "ben",
  format: "pf",
  topic: "Resolved: test",
  message: "gl hf",
  ...overrides,
});

const insertChallenge = (overrides: Partial<typeof schema.practiceChallenges.$inferInsert> = {}) =>
  db.insert(schema.practiceChallenges).values({
    id: CHALLENGE_ID,
    challengerId: "ana",
    opponentId: "ben",
    judgeId: null,
    judgeStatus: null,
    status: "pending",
    format: "pf",
    topic: "Resolved: test",
    message: "",
    proposedAt: null,
    roomId: "practice-11111111",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const notificationsFor = (userId: string) =>
  db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));

beforeEach(async () => {
  signedInAs = "ana";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values([
    ...["ana", "ben", "cy", "dee"].map((id) => ({ id, name: id.toUpperCase(), email: `${id}@example.com`, createdAt: now, updatedAt: now })),
    { id: "guest", name: "Guest", email: "guest@example.com", isAnonymous: true, createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.practiceProfiles).values([
    { userId: "ben", asCompetitor: true, asJudge: false, preferences: volunteer, updatedAt: now },
    { userId: "cy", asCompetitor: false, asJudge: true, preferences: volunteer, updatedAt: now },
    { userId: "dee", asCompetitor: true, asJudge: true, preferences: volunteer, updatedAt: now },
  ]);
});

describe("POST /api/practice-partners/challenges", () => {
  it("needs a session and a JSON body", async () => {
    signedInAs = null;
    expect((await post(validChallenge())).status).toBe(401);
    signedInAs = "ana";
    expect((await post("{nope")).status).toBe(400);
  });

  it("rejects an unreadable challenge, a self-challenge and judging your own round", async () => {
    expect((await post(validChallenge({ format: "nope" }))).status).toBe(400);
    const self = await post(validChallenge({ opponentId: "ana" }));
    expect(await self.json()).toEqual({ error: "You can't challenge yourself." });
    const judgeSelf = await post(validChallenge({ judgeId: "ana" }));
    expect(await judgeSelf.json()).toEqual({ error: "You can't judge a round you're debating in." });
  });

  it("refuses guests and viewers whose account is gone", async () => {
    signedInAs = "guest";
    const guest = await post(validChallenge());
    expect(guest.status).toBe(403);
    signedInAs = "ghost";
    expect((await post(validChallenge())).status).toBe(401);
  });

  it("refuses an opponent who is closed to challenges or blocked", async () => {
    const closed = await post(validChallenge({ opponentId: "cy" }));
    expect(closed.status).toBe(409);
    expect(await closed.json()).toEqual({ error: "That debater isn't open to challenges right now." });

    await db.insert(schema.userBlocks).values({ blockerId: "ben", blockedId: "ana", createdAt: new Date() });
    expect((await post(validChallenge())).status).toBe(409);
  });

  it("refuses a judge who is not volunteering", async () => {
    const res = await post(validChallenge({ opponentId: "dee", judgeId: "ben" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "That judge isn't volunteering right now." });
  });

  it("refuses a second pending challenge to one debater", async () => {
    expect((await post(validChallenge())).status).toBe(201);
    const again = await post(validChallenge());
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "You already have a challenge waiting on this debater." });
  });

  it("caps how many challenges can be waiting on answers", async () => {
    const now = new Date();
    const others = Array.from({ length: MAX_PENDING_OUTGOING }, (_, i) => `other-${i}`);
    await db.insert(schema.user).values(others.map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
    for (const [i, opponentId] of others.entries()) {
      await insertChallenge({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, opponentId });
    }
    const res = await post(validChallenge());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain(`${MAX_PENDING_OUTGOING} challenges`);
  });

  it("creates the challenge and notifies the opponent and the invited judge", async () => {
    const res = await post(validChallenge({ judgeId: "dee" }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ status: "pending", format: "pf", topic: "Resolved: test" });

    const [row] = await db.select().from(schema.practiceChallenges);
    expect(row).toMatchObject({ challengerId: "ana", opponentId: "ben", judgeId: "dee", judgeStatus: "invited" });

    const [forOpponent] = await notificationsFor("ben");
    expect(forOpponent.title).toBe("A practice match challenged you to a round");
    expect(forOpponent.body).toContain("Resolved: test");
    const [forJudge] = await notificationsFor("dee");
    expect(forJudge.title).toBe("ANA invited you to judge a practice round");
  });

  it("redeems a match token for the opponent it was minted for, and rejects a stale one", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = await sealMatchToken("test-secret", { viewerId: "ana", opponentId: "ben" }, nowSeconds);
    const res = await post({ format: "pf", topic: "Open", message: "", matchToken: token });
    expect(res.status).toBe(201);
    expect((await db.select().from(schema.practiceChallenges))[0].opponentId).toBe("ben");

    const expired = await sealMatchToken("test-secret", { viewerId: "ana", opponentId: "dee" }, nowSeconds - 3 * 60 * 60);
    expect((await post({ format: "pf", topic: "Open", matchToken: expired })).status).toBe(410);
    const someoneElses = await sealMatchToken("test-secret", { viewerId: "cy", opponentId: "dee" }, nowSeconds);
    expect((await post({ format: "pf", topic: "Open", matchToken: someoneElses })).status).toBe(410);
    expect((await post({ format: "pf", topic: "Open", matchToken: "garbage" })).status).toBe(410);
  });
});

describe("PATCH /api/practice-partners/challenges/[challengeId]", () => {
  it("validates the session, id, body and action", async () => {
    signedInAs = null;
    expect((await patch(CHALLENGE_ID, { action: "cancel" })).status).toBe(401);
    signedInAs = "ana";
    expect((await patch("not-a-uuid", { action: "cancel" })).status).toBe(400);
    expect((await patch(CHALLENGE_ID, "{nope")).status).toBe(400);
    expect((await patch(CHALLENGE_ID, { action: "explode" })).status).toBe(400);
  });

  it("hides a challenge that does not exist, or one the viewer is not part of", async () => {
    expect((await patch(CHALLENGE_ID, { action: "cancel" })).status).toBe(404);
    await insertChallenge();
    signedInAs = "cy";
    expect((await patch(CHALLENGE_ID, { action: "cancel" })).status).toBe(404);
    signedInAs = "ghost";
    expect((await patch(CHALLENGE_ID, { action: "cancel" })).status).toBe(404);
  });

  it("lets the opponent accept, tells the challenger, and refuses a second answer", async () => {
    await insertChallenge();
    signedInAs = "ben";
    const res = await patch(CHALLENGE_ID, { action: "accept" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "accepted" });
    expect((await db.select().from(schema.practiceChallenges))[0].status).toBe("accepted");
    expect((await notificationsFor("ana"))).toHaveLength(1);

    const again = await patch(CHALLENGE_ID, { action: "accept" });
    expect(again.status).toBe(409);
  });

  it("only lets the challenged debater answer", async () => {
    await insertChallenge();
    const res = await patch(CHALLENGE_ID, { action: "accept" });
    expect(res.status).toBe(403);
    expect((await db.select().from(schema.practiceChallenges))[0].status).toBe("pending");
  });

  it("lets the challenger cancel and notifies the others without naming them", async () => {
    await insertChallenge();
    const res = await patch(CHALLENGE_ID, { action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "cancelled" });
    const [note] = await notificationsFor("ben");
    expect(note.title).toContain("Your practice match");
  });

  it("lets an invited judge confirm", async () => {
    await insertChallenge({ judgeId: "dee", judgeStatus: "invited" });
    signedInAs = "dee";
    const res = await patch(CHALLENGE_ID, { action: "confirm-judge" });
    expect(res.status).toBe(200);
    expect((await db.select().from(schema.practiceChallenges))[0].judgeStatus).toBe("confirmed");
  });

  it("lets a volunteering judge pick up an open round", async () => {
    await insertChallenge({ status: "accepted" });
    signedInAs = "dee";
    const res = await patch(CHALLENGE_ID, { action: "volunteer-judge" });
    expect(res.status).toBe(200);
    expect((await db.select().from(schema.practiceChallenges))[0]).toMatchObject({ judgeId: "dee" });
  });

  it("does not let someone who is not volunteering to judge, or a blocked debater's judge, pick it up", async () => {
    await insertChallenge({ status: "accepted" });
    signedInAs = "cy";
    await db.update(schema.practiceProfiles).set({ asJudge: false }).where(eq(schema.practiceProfiles.userId, "cy"));
    expect((await patch(CHALLENGE_ID, { action: "volunteer-judge" })).status).toBeGreaterThanOrEqual(400);
    expect((await db.select().from(schema.practiceChallenges))[0].judgeId).toBeNull();

    await db.insert(schema.userBlocks).values({ blockerId: "ana", blockedId: "dee", createdAt: new Date() });
    signedInAs = "dee";
    expect((await patch(CHALLENGE_ID, { action: "volunteer-judge" })).status).toBe(404);
  });
});
