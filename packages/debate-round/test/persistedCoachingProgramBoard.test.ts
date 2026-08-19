import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedCoachingProgramBoard } from "../src/state/persistedCoachingProgramBoard";
import { saveCoachingProgram } from "../src/state/coachingPrograms";
import { assignRoundToContributor } from "../src/state/roundContributorAssignments";
import { saveDrillSet } from "../src/state/drillSets";
import type { CoachingProgramConfig, CoachingProgramMemberFlow } from "../src/round/coaching-program";
import type { Drill } from "../src/flow/drill-generator";
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

  it("defaults memberDrills to empty when no memberFlows are supplied", () => {
    saveCoachingProgram(VARSITY);
    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({});
  });

  it("resolves a persisted round-contributor assignment's drill set into memberDrills", () => {
    saveCoachingProgram(VARSITY);
    const drills: Drill[] = [{ kind: "collapse", rowIndex: 0, prompt: "Collapse to the case." }];
    saveDrillSet({ roundId: "round-1", sideKey: "aff", drills });
    assignRoundToContributor({ programId: "varsity", contributorId: "alice", roundId: "round-1" });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({ alice: drills });
  });

  it("ignores a persisted assignment for a contributor outside the program roster", () => {
    saveCoachingProgram(VARSITY);
    const drills: Drill[] = [{ kind: "collapse", rowIndex: 0, prompt: "Collapse to the case." }];
    saveDrillSet({ roundId: "round-1", sideKey: "aff", drills });
    assignRoundToContributor({ programId: "varsity", contributorId: "carol", roundId: "round-1" });

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW);
    expect(board?.memberDrills).toEqual({});
  });

  it("prefers a live memberFlow's generated drills over an assigned round's persisted drill set", () => {
    saveCoachingProgram(VARSITY);
    const assignedDrills: Drill[] = [{ kind: "collapse", rowIndex: 0, prompt: "Collapse to the case." }];
    saveDrillSet({ roundId: "round-1", sideKey: "aff", drills: assignedDrills });
    assignRoundToContributor({ programId: "varsity", contributorId: "alice", roundId: "round-1" });

    const liveFlow: CoachingProgramMemberFlow = {
      contributorId: "alice",
      sideKey: "1AC",
      flow: {
        columns: ["1AC", "1NC"],
        children: [
          {
            content: "Case advantage",
            children: [],
            index: 0,
            level: 1,
            focus: false,
            empty: false,
          },
        ],
      },
    };

    const board = buildPersistedCoachingProgramBoard("varsity", "solvency", NOW, [liveFlow]);
    expect(board?.memberDrills.alice[0]?.kind).toBe("overview");
  });
});
