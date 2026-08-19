import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedCoachingProgramBoard } from "../src/state/persistedCoachingProgramBoard";
import { saveCoachingProgram } from "../src/state/coachingPrograms";
import { saveMemberPracticeFlow } from "../src/state/memberPracticeFlows";
import type { CoachingProgramConfig } from "../src/round/coaching-program";
import { saveGroupChallenge } from "debate-card-search/src/state/groupChallenges";
import { saveContribution } from "debate-card-search/src/state/contributions";
import { recordChallengeWinEvent } from "debate-card-search/src/state/challengeWinEvents";
import type { GroupChallenge } from "debate-card-search/src/lib/group-challenges";
import type { AttributedContribution } from "debate-card-search/src/lib/contribution-leaderboard";
import type { Box, Flow, Round } from "debate-core/src/types/flow";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const NOW = Date.parse("2026-08-10T00:00:00Z");

const VARSITY: CoachingProgramConfig = { id: "varsity", name: "Varsity Squad", memberIds: ["alice", "bob"] };

const SOLVENCY_CHALLENGE: GroupChallenge = {
  id: "challenge-1",
  title: "Find 2 solvency cards this week",
  goal: { kind: "contribution_target", target: { kind: "card", argBlock: "solvency" }, targetCount: 2 },
  memberIds: ["alice", "bob"],
  startsAt: 0,
  endsAt: NOW + 1_000_000,
};

function makeContribution(overrides: Partial<AttributedContribution> & { id: string }): AttributedContribution {
  return {
    contributorId: "alice",
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [],
    reviewerEndorsements: [],
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedCoachingProgramBoard", () => {
  it("returns undefined when the program isn't stored", () => {
    expect(buildPersistedCoachingProgramBoard("missing", "solvency", NOW)).toBeUndefined();
  });

  it("builds a board with an empty topic sprint and challenge board when nothing else is stored", () => {
    saveCoachingProgram(VARSITY);
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);

    expect(board).toBeDefined();
    expect(board?.program).toEqual(VARSITY);
    expect(board?.topicSprint.topic).toBe("solvency");
    expect(board?.topicSprint.questBoard).toEqual([]);
    expect(board?.challengeBoard).toEqual([]);
    expect(board?.memberDrills).toEqual({});
  });

  it("composes the persisted challenge roster, contribution feed, and win events into the live challenge board", () => {
    saveCoachingProgram(VARSITY);
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(
      makeContribution({ id: "card-1", contributorId: "alice", argBlock: "solvency", submittedAt: NOW - 1_000 }),
    );
    recordChallengeWinEvent("bob", NOW - 500);

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);

    expect(board?.challengeBoard).toHaveLength(1);
    expect(board?.challengeBoard[0].challengeId).toBe("challenge-1");
    expect(board?.challengeBoard[0].memberStandings.find((s) => s.contributorId === "alice")?.matchingCount).toBe(1);
  });

  it("excludes a persisted contribution with no submittedAt from the composed board", () => {
    saveCoachingProgram(VARSITY);
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(makeContribution({ id: "card-1", contributorId: "alice", argBlock: "solvency" }));

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.challengeBoard[0].memberStandings).toEqual([]);
  });

  it("defaults memberDrills to empty when no member practice round is registered", () => {
    saveCoachingProgram(VARSITY);
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({});
  });

  it("resolves a roster member's registered, flowed practice round into a real drill set", () => {
    saveCoachingProgram(VARSITY);

    const round: Round = {
      id: 7,
      tournamentName: "Glenbrooks",
      roundLevel: "Octos",
      debaters: { aff: ["A1", "A2"], neg: ["N1", "N2"] },
      judges: [],
      flowIds: [70],
      timestamp: 0,
      status: "completed",
    };
    const argRow: Box = { content: "Case advantage", children: [], index: 0, level: 1, focus: false };
    const flow: Flow = {
      content: "",
      level: 0,
      columns: ["1AC", "1NC"],
      invert: false,
      focus: false,
      index: 0,
      lastFocus: [],
      children: [argRow],
      id: 70,
    };
    localStorage.setItem("rounds", JSON.stringify([round]));
    localStorage.setItem("flows", JSON.stringify([flow]));
    saveMemberPracticeFlow({ contributorId: "alice", roundId: 7, sideKey: "A" });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills.alice).toBeDefined();
    expect(board?.memberDrills.alice.length).toBeGreaterThan(0);
    expect(board?.memberDrills.bob).toBeUndefined();
  });

  it("an explicit memberFlows argument (including []) overrides the persisted composition", () => {
    saveCoachingProgram(VARSITY);
    saveMemberPracticeFlow({ contributorId: "alice", roundId: 7, sideKey: "A" });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW, []);
    expect(board?.memberDrills).toEqual({});
  });
});
