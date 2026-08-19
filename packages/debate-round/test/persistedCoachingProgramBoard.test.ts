import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedCoachingProgramBoard } from "../src/state/persistedCoachingProgramBoard";
import { saveCoachingProgram } from "../src/state/coachingPrograms";
import { saveRoundContributorFlow } from "../src/state/roundContributorFlows";
import { savePracticeRound } from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type {
  CoachingProgramConfig,
  CoachingProgramMemberFlow,
  CoachingProgramMemberPracticeRound,
} from "../src/round/coaching-program";
import { saveGroupChallenge } from "debate-card-search/src/state/groupChallenges";
import { saveContribution } from "debate-card-search/src/state/contributions";
import { recordChallengeWinEvent } from "debate-card-search/src/state/challengeWinEvents";
import type { GroupChallenge } from "debate-card-search/src/lib/group-challenges";
import type { AttributedContribution } from "debate-card-search/src/lib/contribution-leaderboard";

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

  it("defaults memberDrills to empty when no memberFlows are supplied and none are stored", () => {
    saveCoachingProgram(VARSITY);
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({});
  });

  it("defaults memberFlows to a roster member's persisted round-contributor flow", () => {
    saveCoachingProgram(VARSITY);
    saveRoundContributorFlow({
      contributorId: "alice",
      roundId: "round-1",
      sideKey: "A",
      flow: {
        columns: ["1AC", "1NC"],
        children: [
          {
            content: "Solvency contention",
            children: [],
            index: 0,
            level: 1,
            focus: false,
            empty: false,
          },
        ],
      },
    });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);

    expect(Object.keys(board?.memberDrills ?? {})).toEqual(["alice"]);
    expect(board?.memberDrills.alice.length).toBeGreaterThan(0);
  });

  it("excludes a stored round-contributor flow for a contributor outside the program's roster", () => {
    saveCoachingProgram(VARSITY);
    saveRoundContributorFlow({
      contributorId: "eve",
      roundId: "round-1",
      sideKey: "A",
      flow: { columns: ["1AC", "1NC"], children: [] },
    });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({});
  });

  it("lets an explicit memberFlows argument override the persisted lookup", () => {
    saveCoachingProgram(VARSITY);
    saveRoundContributorFlow({
      contributorId: "alice",
      roundId: "round-1",
      sideKey: "A",
      flow: { columns: ["1AC", "1NC"], children: [] },
    });

    const override: CoachingProgramMemberFlow[] = [];
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW, override);
    expect(board?.memberDrills).toEqual({});
  });

  it("defaults memberPracticeRounds to a roster member's linked Practice Round Simulator round", () => {
    saveCoachingProgram(VARSITY);
    saveRoundContributorFlow({
      contributorId: "alice",
      roundId: "round-1",
      sideKey: "A",
      flow: { columns: ["1AC", "1NC"], children: [] },
    });
    const setup = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });
    savePracticeRound({ roundId: "round-1", setup });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);

    expect(board?.memberPracticeRounds.alice).toEqual({
      contributorId: "alice",
      roundId: "round-1",
      setup,
      feedback: undefined,
    });
  });

  it("defaults memberPracticeRounds to empty when no roster member has a linked practice round", () => {
    saveCoachingProgram(VARSITY);
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberPracticeRounds).toEqual({});
  });

  it("lets an explicit memberPracticeRounds argument override the persisted lookup", () => {
    saveCoachingProgram(VARSITY);
    saveRoundContributorFlow({
      contributorId: "alice",
      roundId: "round-1",
      sideKey: "A",
      flow: { columns: ["1AC", "1NC"], children: [] },
    });
    savePracticeRound({
      roundId: "round-1",
      setup: buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" }),
    });

    const override: CoachingProgramMemberPracticeRound[] = [];
    const board = buildPersistedCoachingProgramBoard(
      "varsity",
      "solvency",
      NOW,
      undefined,
      undefined,
      override,
    );
    expect(board?.memberPracticeRounds).toEqual({});
  });
});
