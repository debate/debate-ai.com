/**
 * @fileoverview `/api/debate-challenges` against a real SQLite database, with
 * the model calls stubbed: a player-vs-player round from challenge to judged
 * result, a round against the AI, forfeits on a missed response window, and
 * collecting XP once.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { DEBATE_CHALLENGES_DDL, resetEnsuredDebateChallengeTables } from "@/lib/debate-challenges/ensure-tables";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alice";
/** What the stubbed model answers: a judge JSON when asked to judge, else a speech. */
let modelOnline = true;
let judgeWinner: "aff" | "neg" = "neg";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/debate-challenges/ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/debate-challenges/ai")>();
  return {
    ...real,
    challengeTextGenerator: () => async (prompt: string) => {
      if (!modelOnline) return null;
      if (prompt.includes('"winner"')) return JSON.stringify({ winner: judgeWinner, reason: "Better weighing on the key clash." });
      return "The AI's speech: the other side's harms are speculative and outweighed by our impacts.";
    },
  };
});

const { GET, POST } = await import("@/app/api/debate-challenges/route");
const { PATCH } = await import("@/app/api/debate-challenges/[challengeId]/route");

const SPEECH = "Contention one: the resolution prevents real harms, and here is why that outweighs.";

async function as<T>(userId: string | null, call: () => Promise<Response>): Promise<{ status: number; body: T }> {
  signedInAs = userId;
  const res = await call();
  return { status: res.status, body: (await res.json()) as T };
}

const board = (userId: string | null) =>
  as<Record<string, any>>(userId, () => GET(new Request("https://d.ebate.app/api/debate-challenges") as never));
const send = (userId: string, body: unknown) =>
  as<Record<string, any>>(userId, () =>
    POST(new Request("https://d.ebate.app/api/debate-challenges", { method: "POST", body: JSON.stringify(body) }) as never),
  );
const act = (userId: string, id: string, body: unknown) =>
  as<Record<string, any>>(userId, () =>
    PATCH(new Request(`https://d.ebate.app/api/debate-challenges/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as never, {
      params: Promise.resolve({ challengeId: id }),
    }),
  );

const TOPIC = "Resolved: The United States federal government should ban hyperscale data centers.";

describe("/api/debate-challenges", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    modelOnline = true;
    judgeWinner = "neg";
    resetEnsuredDebateChallengeTables();
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["alice", "bob", "guest"].map((id) => ({
        id,
        name: id === "alice" ? "Alice" : id === "bob" ? "Bob" : "Guest",
        email: `${id}@example.com`,
        isAnonymous: id === "guest",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is account-only", async () => {
    expect((await board(null)).status).toBe(401);
  });

  it("runs a player-vs-player round from challenge to the judge's decision, notifying each turn", async () => {
    const sent = await send("alice", { opponentId: "bob", format: "pf", topic: TOPIC, side: "aff", speech: SPEECH });
    expect(sent.status).toBe(201);
    const id = sent.body.challenge.id as string;
    expect(sent.body.challenge).toMatchObject({ status: "pending", turnId: "bob", viewerSide: "aff" });

    const bobBoard = await board("bob");
    expect(bobBoard.body.challenges[0]).toMatchObject({ id, viewerSide: "neg", moves: ["speak", "decline"] });

    expect((await act("alice", id, { action: "speak", text: SPEECH })).status).toBe(409);
    expect((await act("bob", id, { action: "speak", text: SPEECH })).body.challenge.status).toBe("active");
    await act("alice", id, { action: "speak", text: SPEECH });
    const last = await act("bob", id, { action: "speak", text: SPEECH });
    // The fourth speech goes straight to the judge.
    expect(last.body.challenge).toMatchObject({ status: "complete", winnerSide: "neg", decisionMethod: "judge" });
    expect(last.body.challenge.decision).toContain("weighing");

    const notes = await db.select().from(schema.notifications);
    expect(notes.every((note) => note.type === "debate_challenge" && note.link === "/practice/challenges")).toBe(true);
    // Bob: the challenge, Alice's rebuttal, his win. Alice: each of Bob's two
    // speeches before the last, then the decision.
    expect(notes.map((note) => note.userId).sort()).toEqual(["alice", "alice", "alice", "bob", "bob", "bob"]);

    const bobAfter = await board("bob");
    expect(bobAfter.body.stats).toMatchObject({ wins: 1, losses: 0, nextBoost: 1.5 });
    expect(bobAfter.body.trophies.find((t: { id: string }) => t.id === "first-win").earned).toBe(true);
    expect(bobAfter.body.challenges[0].reward).toMatchObject({ xp: 60, won: true, claimed: false });
    expect(bobAfter.body.challenges[0].moves).toEqual(["claim"]);
  });

  it("lets each debater collect a round's XP once", async () => {
    const sent = await send("alice", { opponentId: "bob", format: "ld", topic: TOPIC, side: "neg" });
    const id = sent.body.challenge.id as string;
    await act("bob", id, { action: "speak", text: SPEECH });
    await act("alice", id, { action: "concede" });

    const first = await act("bob", id, { action: "claim" });
    expect(first.status).toBe(200);
    expect(first.body.challenge.reward).toMatchObject({ claimed: true });
    expect((await act("bob", id, { action: "claim" })).status).toBe(409);
    // Alice conceded, but finishing still pays the round.
    expect((await act("alice", id, { action: "claim" })).status).toBe(200);
  });

  it("plays the AI's speeches as soon as it is the AI's turn, then judges", async () => {
    judgeWinner = "aff";
    const sent = await send("alice", { opponentId: "ai", aiLevel: "champion", format: "policy", topic: TOPIC, side: "aff", speech: SPEECH });
    const id = sent.body.challenge.id as string;
    expect(sent.body.challenge).toMatchObject({ status: "active", turnId: "alice", vsAi: true, aiLevel: "champion" });
    expect(sent.body.challenge.speeches).toHaveLength(2);
    expect(sent.body.challenge.opponent.name).toBe("AI opponent (Champion)");

    const done = await act("alice", id, { action: "speak", text: SPEECH });
    expect(done.body.challenge).toMatchObject({ status: "complete", winnerSide: "aff" });
    const after = await board("alice");
    expect(after.body.trophies.find((t: { id: string }) => t.id === "beat-the-ai").earned).toBe(true);
  });

  it("retries the AI on the next board read when the model was down", async () => {
    modelOnline = false;
    const sent = await send("alice", { opponentId: "ai", format: "pf", topic: TOPIC, side: "aff", speech: SPEECH });
    expect(sent.body.challenge).toMatchObject({ status: "pending", turnId: "ai" });
    modelOnline = true;
    expect((await board("alice")).body.challenges[0]).toMatchObject({ status: "active", turnId: "alice" });
  });

  it("forfeits a round whose response window ran out, and expires an unanswered one", async () => {
    const live = await send("alice", { opponentId: "bob", format: "pf", topic: TOPIC, side: "aff", speech: SPEECH });
    await act("bob", live.body.challenge.id, { action: "speak", text: SPEECH });
    const ignored = await send("bob", { opponentId: "alice", format: "ld", topic: TOPIC, side: "neg" });

    vi.setSystemTime(new Date("2026-11-13T12:00:01Z"));
    const after = await board("alice");
    const byId = new Map(after.body.challenges.map((c: { id: string }) => [c.id, c]));
    expect(byId.get(live.body.challenge.id)).toMatchObject({ status: "complete", winnerSide: "neg", decisionMethod: "forfeit" });
    expect(byId.get(ignored.body.challenge.id)).toMatchObject({ status: "expired", winnerSide: null });
    // Losing on time pays nothing.
    expect((byId.get(live.body.challenge.id) as { reward: { xp: number } }).reward.xp).toBe(0);
  });

  it("refuses self-challenges, guests, unknown players and duplicate challenges", async () => {
    const body = { format: "pf", topic: TOPIC, side: "neg" };
    expect((await send("alice", { ...body, opponentId: "alice" })).status).toBe(400);
    expect((await send("alice", { ...body, opponentId: "guest" })).status).toBe(404);
    expect((await send("alice", { ...body, opponentId: "nobody" })).status).toBe(404);
    expect((await send("guest", { ...body, opponentId: "alice" })).status).toBe(403);
    expect((await send("alice", { ...body, opponentId: "bob" })).status).toBe(201);
    expect((await send("alice", { ...body, opponentId: "bob" })).status).toBe(409);
    expect((await send("alice", { ...body, opponentId: "bob", side: "aff" })).status).toBe(409);
  });

  it("hides a challenge from anyone not debating in it", async () => {
    const sent = await send("alice", { opponentId: "bob", format: "pf", topic: TOPIC, side: "neg" });
    expect((await act("guest", sent.body.challenge.id, { action: "decline" })).status).toBe(404);
  });
});

describe("DEBATE_CHALLENGES_DDL", () => {
  it("creates the same columns as the schema", async () => {
    const fromSchema = await freshSchemaClient();
    const fromDdl = createClient({ url: ":memory:" });
    await fromDdl.execute(`CREATE TABLE "user" ("id" text PRIMARY KEY NOT NULL)`);
    for (const statement of DEBATE_CHALLENGES_DDL) await fromDdl.execute(statement);
    const columns = async (client: typeof fromDdl) =>
      (await client.execute(`PRAGMA table_info("debate_challenges")`)).rows.map((row) => [
        row.name,
        String(row.type).toLowerCase(),
        row.notnull,
        row.pk,
      ]);
    expect(await columns(fromDdl)).toEqual(await columns(fromSchema));
  });
});
