/**
 * @fileoverview The Online Challenge rules: turn order, who may make which
 * move, the AI's turns and the judge, and what a missed response window does.
 */

import { describe, expect, it } from "vitest";

import {
  applyAiSpeech,
  applyChallengeMove,
  applyJudgeDecision,
  availableMoves,
  createChallengeRound,
  settleOverdue,
  speechError,
  turnOf,
  type ChallengeRoundState,
} from "../../src/debate-challenges/rules";
import { AI_OPPONENT_ID, RESPONSE_WINDOW_SECONDS } from "../../src/debate-challenges/types";

const NOW = 1_800_000_000;
const SPEECH = "My first contention is that the resolution helps the most people, because of these warrants.";

function created(side: "aff" | "neg", opponentId = "bob"): ChallengeRoundState {
  const result = createChallengeRound(
    { challengerId: "alice", opponentId, challengerSide: side, openingSpeech: side === "aff" ? SPEECH : undefined },
    NOW,
  );
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function speak(state: ChallengeRoundState, who: string, at = NOW + 60): ChallengeRoundState {
  const result = applyChallengeMove(state, who, "speak", at, SPEECH);
  if (!result.ok) throw new Error(result.error);
  return result.next;
}

describe("createChallengeRound", () => {
  it("sends an Aff challenger's opening speech with the challenge and starts the opponent's clock", () => {
    const state = created("aff");
    expect(state.status).toBe("pending");
    expect(state.speeches).toHaveLength(1);
    expect(state.speeches[0]).toMatchObject({ side: "aff", authorId: "alice" });
    expect(state.deadlineAt).toBe(NOW + RESPONSE_WINDOW_SECONDS);
    expect(turnOf(state)).toBe("bob");
  });

  it("has a Neg challenger wait on the opponent's constructive", () => {
    const state = created("neg");
    expect(state.speeches).toHaveLength(0);
    expect(turnOf(state)).toBe("bob");
  });

  it("refuses an Aff challenge without an opening speech", () => {
    const result = createChallengeRound({ challengerId: "alice", opponentId: "bob", challengerSide: "aff" }, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("applyChallengeMove", () => {
  it("runs the four speeches in order, accepting on the opponent's first, then goes to the judge", () => {
    let state = created("aff");
    state = speak(state, "bob");
    expect(state.status).toBe("active");
    expect(turnOf(state)).toBe("alice");
    state = speak(state, "alice");
    expect(turnOf(state)).toBe("bob");
    state = speak(state, "bob", NOW + 120);
    expect(state.status).toBe("judging");
    expect(state.deadlineAt).toBeNull();
    expect(state.speeches.map((s) => s.side)).toEqual(["aff", "neg", "aff", "neg"]);
  });

  it("restarts the response window with every speech", () => {
    const state = speak(created("aff"), "bob", NOW + 500);
    expect(state.deadlineAt).toBe(NOW + 500 + RESPONSE_WINDOW_SECONDS);
  });

  it("refuses a speech out of turn, from an outsider, or too short", () => {
    const state = created("aff");
    expect(applyChallengeMove(state, "alice", "speak", NOW, SPEECH)).toMatchObject({ ok: false, status: 409 });
    expect(applyChallengeMove(state, "carol", "speak", NOW, SPEECH)).toMatchObject({ ok: false, status: 403 });
    expect(applyChallengeMove(state, "bob", "speak", NOW, "too short")).toMatchObject({ ok: false, status: 400 });
  });

  it("lets only the opponent decline, and only the challenger withdraw, before an answer", () => {
    const state = created("neg");
    expect(applyChallengeMove(state, "alice", "decline", NOW)).toMatchObject({ ok: false, status: 403 });
    expect(applyChallengeMove(state, "bob", "cancel", NOW)).toMatchObject({ ok: false, status: 403 });
    const declined = applyChallengeMove(state, "bob", "decline", NOW);
    expect(declined).toMatchObject({ ok: true, notify: ["alice"] });
    const cancelled = applyChallengeMove(state, "alice", "cancel", NOW);
    expect(cancelled.ok && cancelled.next.status).toBe("cancelled");
  });

  it("gives a conceded round to the other side", () => {
    const state = speak(created("aff"), "bob");
    const result = applyChallengeMove(state, "alice", "concede", NOW + 100);
    expect(result.ok && result.next).toMatchObject({ status: "complete", winnerSide: "neg", decisionMethod: "concession" });
    expect(applyChallengeMove(created("aff"), "alice", "concede", NOW).ok).toBe(false);
  });

  it("never notifies the AI", () => {
    const state = created("neg", AI_OPPONENT_ID);
    const result = applyChallengeMove(state, "alice", "cancel", NOW);
    expect(result.ok && result.notify).toEqual([]);
  });
});

describe("availableMoves", () => {
  it("offers the opponent speak and decline, and the challenger withdraw", () => {
    const state = created("aff");
    expect(availableMoves(state, "bob", NOW)).toEqual(["speak", "decline"]);
    expect(availableMoves(state, "alice", NOW)).toEqual(["cancel"]);
    expect(availableMoves(state, "carol", NOW)).toEqual([]);
  });
});

describe("the AI and the judge", () => {
  it("lets the AI speak only on its own turn", () => {
    const state = created("aff", AI_OPPONENT_ID);
    expect(turnOf(state)).toBe(AI_OPPONENT_ID);
    const next = applyAiSpeech(state, "The AI's negative constructive.", NOW + 1);
    expect(next?.speeches[1]).toMatchObject({ side: "neg", authorId: null });
    expect(next && applyAiSpeech(next, "Again", NOW + 2)).toBeNull();
    expect(applyAiSpeech(created("aff"), "Not an AI round", NOW)).toBeNull();
  });

  it("records the judge's winner only once all speeches are in", () => {
    let state = created("aff");
    expect(applyJudgeDecision(state, "aff", NOW)).toBeNull();
    state = speak(speak(speak(state, "bob"), "alice"), "bob");
    expect(applyJudgeDecision(state, "aff", NOW + 9)).toMatchObject({
      status: "complete",
      winnerSide: "aff",
      decisionMethod: "judge",
      completedAt: NOW + 9,
    });
  });
});

describe("settleOverdue", () => {
  it("expires a challenge nobody answered, with no winner", () => {
    const state = created("aff");
    expect(settleOverdue(state, NOW + RESPONSE_WINDOW_SECONDS - 1)).toBeNull();
    expect(settleOverdue(state, NOW + RESPONSE_WINDOW_SECONDS)).toMatchObject({ status: "expired", winnerSide: null });
  });

  it("forfeits an active round to the side that wasn't on the clock", () => {
    const state = speak(created("aff"), "bob"); // alice (aff) to speak
    const settled = settleOverdue(state, (state.deadlineAt ?? 0) + 1);
    expect(settled).toMatchObject({ status: "complete", winnerSide: "neg", decisionMethod: "forfeit" });
  });

  it("never forfeits for the AI", () => {
    const state = created("aff", AI_OPPONENT_ID);
    expect(settleOverdue(state, NOW + RESPONSE_WINDOW_SECONDS * 10)).toBeNull();
  });
});

describe("speechError", () => {
  it("accepts a real speech and names the problem otherwise", () => {
    expect(speechError(SPEECH)).toBeNull();
    expect(speechError("")).toMatch(/at least/);
    expect(speechError("x".repeat(20_000))).toMatch(/at most/);
    expect(speechError(42)).toMatch(/Write/);
  });
});
