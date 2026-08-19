import { beforeEach, describe, expect, it } from "vitest";
import {
  buildPersistedGroupChallengeBoard,
  listChallengeWinEvents,
  recordChallengeWinEvent,
} from "../src/state/challengeWinEvents";
import { saveGroupChallenge } from "../src/state/groupChallenges";
import { saveContribution } from "../src/state/contributions";
import type { GroupChallenge } from "../src/lib/group-challenges";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";

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

const REBUTTAL_CHALLENGE: GroupChallenge = {
  id: "challenge-2",
  title: "Win 5 rebuttal exercises",
  goal: { kind: "win_target", targetCount: 5 },
  memberIds: ["carol", "dave"],
  startsAt: 100,
  endsAt: 200,
};

const SOLVENCY_CHALLENGE: GroupChallenge = {
  id: "challenge-1",
  title: "Find 2 solvency cards this week",
  goal: { kind: "contribution_target", target: { kind: "card", argBlock: "solvency" }, targetCount: 2 },
  memberIds: ["alice", "bob"],
  startsAt: 0,
  endsAt: 1_000,
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

describe("listChallengeWinEvents", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listChallengeWinEvents()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("challengeWinEvents", "{not json");
    expect(listChallengeWinEvents()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("challengeWinEvents", JSON.stringify({ not: "an array" }));
    expect(listChallengeWinEvents()).toEqual([]);
  });
});

describe("recordChallengeWinEvent", () => {
  it("appends a win event and returns it", () => {
    const event = recordChallengeWinEvent("carol", 150);
    expect(event).toEqual({ contributorId: "carol", occurredAt: 150 });
    expect(listChallengeWinEvents()).toEqual([{ contributorId: "carol", occurredAt: 150 }]);
  });

  it("accumulates multiple win events without overwriting earlier ones", () => {
    recordChallengeWinEvent("carol", 150);
    recordChallengeWinEvent("dave", 160);
    expect(listChallengeWinEvents()).toEqual([
      { contributorId: "carol", occurredAt: 150 },
      { contributorId: "dave", occurredAt: 160 },
    ]);
  });
});

describe("buildPersistedGroupChallengeBoard", () => {
  it("returns an empty board when no challenges are persisted", () => {
    expect(buildPersistedGroupChallengeBoard(1_000)).toEqual([]);
  });

  it("reflects a persisted win event in a win_target challenge's standings", () => {
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("carol", 150);

    const board = buildPersistedGroupChallengeBoard(190);
    const progress = board.find((entry) => entry.challengeId === "challenge-2");
    expect(progress?.completedCount).toBe(1);
    expect(progress?.memberStandings).toEqual([{ contributorId: "carol", matchingCount: 1 }]);
    expect(progress?.mvpContributorId).toBe("carol");
  });

  it("excludes a win event outside the challenge's roster or window", () => {
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("eve", 150); // not on the roster
    recordChallengeWinEvent("carol", 500); // outside the window

    const board = buildPersistedGroupChallengeBoard(600);
    const progress = board.find((entry) => entry.challengeId === "challenge-2");
    expect(progress?.completedCount).toBe(0);
  });

  it("reflects real persisted contributions in a contribution_target challenge's standings", () => {
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(
      makeContribution({ id: "c1", contributorId: "alice", kind: "card", argBlock: "solvency", submittedAt: 500 }),
    );

    const board = buildPersistedGroupChallengeBoard(600);
    const progress = board.find((entry) => entry.challengeId === "challenge-1");
    expect(progress?.completedCount).toBe(1);
  });

  it("excludes a persisted contribution with no submittedAt timestamp", () => {
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(makeContribution({ id: "c1", contributorId: "alice", kind: "card", argBlock: "solvency" }));

    const board = buildPersistedGroupChallengeBoard(600);
    const progress = board.find((entry) => entry.challengeId === "challenge-1");
    expect(progress?.completedCount).toBe(0);
  });
});
