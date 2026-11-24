/**
 * @fileoverview `lib/practice-partners/queries.ts` against a real SQLite
 * database: profiles and the volunteer/coaching boards (blocks and guests left
 * out), challenges with their anonymity rule, the open-to-judge list's grace
 * window, the guarded state write two people can race on, and notifications.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { ANONYMOUS_PRACTICE_PERSON, DEFAULT_PRACTICE_PROFILE } from "@debate-ai/practice-rounds/src/practice-partners/types";
import type { ParsedChallenge } from "@debate-ai/practice-rounds/src/practice-partners/validation";
import * as q from "../queries";

let db: ReturnType<typeof drizzle<typeof schema>>;

const people = ["ana", "ben", "cy", "dee", "eve"];

beforeEach(async () => {
  const client = await freshSchemaClient();
  await client.execute("PRAGMA foreign_keys = ON");
  db = drizzle(client, { schema });
  const now = new Date();
  await db.insert(schema.user).values([
    ...people.map((id) => ({ id, name: id.toUpperCase(), email: `${id}@example.com`, image: id === "ana" ? "https://img/ana" : null, createdAt: now, updatedAt: now })),
    { id: "guest", name: "Guest", email: "guest@example.com", isAnonymous: true, createdAt: now, updatedAt: now },
  ]);
});

const profile = (overrides: Partial<typeof DEFAULT_PRACTICE_PROFILE>) => ({ ...DEFAULT_PRACTICE_PROFILE, ...overrides });

const challenge = (overrides: Partial<ParsedChallenge> = {}): ParsedChallenge => ({
  opponentId: "ben",
  judgeId: null,
  format: "pf",
  topic: "Resolved: test",
  message: "gl hf",
  proposedAt: null,
  ...overrides,
});

describe("viewer and profiles", () => {
  it("reads the viewer with their guest flag, and null when gone", async () => {
    expect(await q.getViewer(db, "ana")).toEqual({ id: "ana", name: "ANA", imageUrl: "https://img/ana", isAnonymous: false });
    expect((await q.getViewer(db, "guest"))?.isAnonymous).toBe(true);
    expect(await q.getViewer(db, "nobody")).toBeNull();
  });

  it("saves, reads back and replaces a profile, coaching fields included", async () => {
    expect(await q.getProfile(db, "ana")).toBeNull();
    const first = profile({ asCompetitor: true, formats: ["pf", "ld"], level: "varsity" as never, availability: "weekends", asCoach: true, coachingDetails: "LD phil" });
    await q.upsertProfile(db, "ana", first);
    expect(await q.getProfile(db, "ana")).toEqual(first);

    const second = profile({ asJudge: true });
    await q.upsertProfile(db, "ana", second);
    expect(await q.getProfile(db, "ana")).toEqual(second);
    expect(await db.select().from(schema.practiceProfiles)).toHaveLength(1);
  });

  it("collects block pairs in both directions", async () => {
    await db.insert(schema.userBlocks).values([
      { blockerId: "ana", blockedId: "ben", createdAt: new Date() },
      { blockerId: "cy", blockedId: "ana", createdAt: new Date() },
      { blockerId: "dee", blockedId: "eve", createdAt: new Date() },
    ]);
    expect([...(await q.loadBlockedIds(db, "ana"))].sort()).toEqual(["ben", "cy"]);
  });
});

describe("listVolunteers", () => {
  it("lists other volunteers newest first, skipping blocked, guests and people in no role", async () => {
    const save = async (id: string, p: Partial<typeof DEFAULT_PRACTICE_PROFILE>, at: number) => {
      await q.upsertProfile(db, id, profile(p));
      await db.update(schema.practiceProfiles).set({ updatedAt: new Date(at * 1000) }).where(eq(schema.practiceProfiles.userId, id));
    };
    await save("ana", { asCompetitor: true }, 100);
    await save("ben", { asCompetitor: true, formats: ["policy"] }, 200);
    await save("cy", { asJudge: true }, 300);
    await save("dee", {}, 400); // no role
    await save("eve", { asJudge: true }, 500);
    await save("guest", { asCompetitor: true }, 600);

    const list = await q.listVolunteers(db, "ana", new Set(["eve"]));
    expect(list.map((v) => v.person.id)).toEqual(["cy", "ben"]);
    expect(list[1]).toMatchObject({ asCompetitor: true, asJudge: false, formats: ["policy"], updatedAt: 200, person: { id: "ben", name: "BEN", imageUrl: null } });
  });
});

describe("listCoachingSignups", () => {
  it("splits coaches from teams seeking one, including the viewer, minus blocks and guests", async () => {
    await q.upsertProfile(db, "ana", profile({ asCoach: true, coachingDetails: "Policy K", formats: ["policy"] }));
    await q.upsertProfile(db, "ben", profile({ seeksCoach: true, availability: "Tue" }));
    await q.upsertProfile(db, "cy", profile({ asCoach: true, seeksCoach: true }));
    await q.upsertProfile(db, "dee", profile({ asCompetitor: true }));
    await q.upsertProfile(db, "eve", profile({ asCoach: true }));
    await q.upsertProfile(db, "guest", profile({ asCoach: true }));

    const board = await q.listCoachingSignups(db, new Set(["eve"]));
    expect(board.coaches.map((c) => c.person.id).sort()).toEqual(["ana", "cy"]);
    expect(board.teams.map((c) => c.person.id).sort()).toEqual(["ben", "cy"]);
    expect(board.coaches.find((c) => c.person.id === "ana")).toMatchObject({ details: "Policy K", formats: ["policy"] });
    expect(board.teams.find((c) => c.person.id === "ben")).toMatchObject({ availability: "Tue", details: "" });
  });
});

describe("challenges", () => {
  it("inserts a challenge, deriving room id and judge invite, read back for the challenger", async () => {
    const created = await q.insertChallenge(db, { id: "ABCDEF12-0000", challengerId: "ana", challenge: challenge({ judgeId: "cy", proposedAt: 1_800_000_000 }) });
    expect(created).toMatchObject({
      id: "ABCDEF12-0000",
      status: "pending",
      challenger: { id: "ana", name: "ANA" },
      // Pending, so the opponent stays anonymous to the challenger.
      opponent: ANONYMOUS_PRACTICE_PERSON,
      judge: { id: "cy" },
      judgeStatus: "invited",
      roomId: "practice-abcdef12",
      proposedAt: 1_800_000_000,
      format: "pf",
    });
  });

  it("reveals both debaters once accepted, and never hides the viewer from themselves", async () => {
    await q.insertChallenge(db, { id: "c1", challengerId: "ana", challenge: challenge() });
    const asBen = await q.getChallenge(db, "c1", "ben");
    expect(asBen?.challenger).toEqual(ANONYMOUS_PRACTICE_PERSON);
    expect(asBen?.opponent.id).toBe("ben");

    const row = (await q.getChallengeRow(db, "c1"))!;
    const from = q.rowState(row);
    expect(from).toEqual({ status: "pending", challengerId: "ana", opponentId: "ben", judgeId: null, judgeStatus: null });
    expect(await q.updateChallengeState(db, "c1", from, { ...from, status: "accepted" })).toBe(true);
    const accepted = await q.getChallenge(db, "c1", "ben");
    expect(accepted?.challenger.id).toBe("ana");
    expect(accepted?.judge).toBeNull();
    expect(accepted?.judgeStatus).toBeNull();
  });

  it("guards the state write: a second writer acting on stale state loses", async () => {
    await q.insertChallenge(db, { id: "c1", challengerId: "ana", challenge: challenge() });
    await q.updateChallengeState(db, "c1", q.rowState((await q.getChallengeRow(db, "c1"))!), {
      status: "accepted", challengerId: "ana", opponentId: "ben", judgeId: null, judgeStatus: null,
    });
    const open = q.rowState((await q.getChallengeRow(db, "c1"))!);
    // Two judges pick the seat from the same open state.
    expect(await q.updateChallengeState(db, "c1", open, { ...open, judgeId: "cy", judgeStatus: "confirmed" })).toBe(true);
    expect(await q.updateChallengeState(db, "c1", open, { ...open, judgeId: "dee", judgeStatus: "confirmed" })).toBe(false);
    expect((await q.getChallengeRow(db, "c1"))?.judgeId).toBe("cy");
    // A write from the current state, judge included, lands.
    const judged = q.rowState((await q.getChallengeRow(db, "c1"))!);
    expect(judged.judgeStatus).toBe("confirmed");
    expect(await q.updateChallengeState(db, "c1", judged, { ...judged, status: "cancelled" })).toBe(true);
    expect(await q.updateChallengeState(db, "missing", judged, judged)).toBe(false);
  });

  it("returns null for an unknown challenge, and drops one whose debater is gone", async () => {
    expect(await q.getChallenge(db, "nope", "ana")).toBeNull();
    await q.insertChallenge(db, { id: "c1", challengerId: "ana", challenge: challenge() });
    await db.delete(schema.user).where(eq(schema.user.id, "ben"));
    // The foreign-key cascade takes the challenge with the account.
    expect(await q.getChallenge(db, "c1", "ana")).toBeNull();
  });

  it("lists every challenge the viewer is in, as any role, newest first", async () => {
    await q.insertChallenge(db, { id: "c1", challengerId: "ana", challenge: challenge({ opponentId: "ben" }) });
    await q.insertChallenge(db, { id: "c2", challengerId: "ben", challenge: challenge({ opponentId: "cy", judgeId: "ana" }) });
    await q.insertChallenge(db, { id: "c3", challengerId: "dee", challenge: challenge({ opponentId: "ana" }) });
    await q.insertChallenge(db, { id: "c4", challengerId: "dee", challenge: challenge({ opponentId: "eve" }) });
    for (const [id, at] of [["c1", 1], ["c2", 3], ["c3", 2]] as const) {
      await db.update(schema.practiceChallenges).set({ createdAt: new Date(at * 1000) }).where(eq(schema.practiceChallenges.id, id));
    }
    expect((await q.listChallengesFor(db, "ana")).map((c) => c.id)).toEqual(["c2", "c3", "c1"]);
  });

  it("counts and lists pending outgoing challenges", async () => {
    await q.insertChallenge(db, { id: "c1", challengerId: "ana", challenge: challenge({ opponentId: "ben" }) });
    await q.insertChallenge(db, { id: "c2", challengerId: "ana", challenge: challenge({ opponentId: "cy" }) });
    await q.insertChallenge(db, { id: "c3", challengerId: "ben", challenge: challenge({ opponentId: "ana" }) });
    const from = q.rowState((await q.getChallengeRow(db, "c2"))!);
    await q.updateChallengeState(db, "c2", from, { ...from, status: "declined" });

    expect(await q.countPendingOutgoing(db, "ana")).toBe(1);
    expect([...(await q.listPendingOpponentIds(db, "ana"))]).toEqual(["ben"]);
    expect(await q.hasPendingChallenge(db, "ana", "ben")).toBe(true);
    expect(await q.hasPendingChallenge(db, "ana", "cy")).toBe(false);
    expect(await q.hasPendingChallenge(db, "ben", "ana")).toBe(true);
  });
});

describe("listOpenToJudge", () => {
  const NOW = 1_800_000_000;

  async function accepted(id: string, challengerId: string, opponentId: string, proposedAt: number | null, judgeId: string | null = null) {
    await q.insertChallenge(db, { id, challengerId, challenge: challenge({ opponentId, proposedAt, judgeId }) });
    const from = q.rowState((await q.getChallengeRow(db, id))!);
    await q.updateChallengeState(db, id, from, { ...from, status: "accepted" });
  }

  it("offers accepted, unjudged rounds that are not the viewer's, not blocked and not long past", async () => {
    await accepted("open", "ben", "cy", NOW + 3600);
    await accepted("no-time", "ben", "dee", null);
    await accepted("just-started", "cy", "dee", NOW - 2 * 3600);
    await accepted("long-past", "cy", "eve", NOW - 4 * 3600);
    await accepted("mine", "ana", "ben", NOW);
    await accepted("blocked", "eve", "ben", NOW);
    await accepted("judged", "ben", "eve", NOW, "dee");
    await q.insertChallenge(db, { id: "pending", challengerId: "cy", challenge: challenge({ opponentId: "ben" }) });

    const list = await q.listOpenToJudge(db, "ana", new Set(["eve"]), NOW);
    expect(list.map((c) => c.id).sort()).toEqual(["just-started", "no-time", "open"]);
    // No viewer: nobody on the list is anonymised.
    expect(list.every((c) => c.challenger.id !== "anonymous" && c.opponent.id !== "anonymous")).toBe(true);
  });
});

describe("notifyPracticePartners", () => {
  it("writes one row per recipient pointing at the board, and nothing for none", async () => {
    await q.notifyPracticePartners(db, [], { title: "t", body: "b" });
    expect(await db.select().from(schema.notifications)).toHaveLength(0);
    await q.notifyPracticePartners(db, ["ana", "ben"], { title: "New challenge", body: "From CY" });
    const rows = await db.select().from(schema.notifications);
    expect(rows.map((r) => r.userId).sort()).toEqual(["ana", "ben"]);
    expect(rows[0]).toMatchObject({ type: "practice_challenge", title: "New challenge", body: "From CY", link: q.PRACTICE_PARTNERS_LINK });
  });
});
