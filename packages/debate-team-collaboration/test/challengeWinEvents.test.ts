import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCompletedGroupChallengeEvents,
  buildPersistedGroupChallengeBoard,
  listChallengeWinEvents,
  recordChallengeWinEvent,
} from "../src/state/challengeWinEvents";
import { saveGroupChallenge } from "../src/state/groupChallenges";
import { saveContribution } from "debate-research-evidence/src/state/contributions";
import type { GroupChallenge } from "../src/lib/group-challenges";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";

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

describe("buildCompletedGroupChallengeEvents", () => {
  it("returns an empty list when no challenges are persisted", () => {
    expect(buildCompletedGroupChallengeEvents()).toEqual([]);
  });

  it("excludes a challenge whose goal hasn't been reached yet", () => {
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("carol", 150);
    expect(buildCompletedGroupChallengeEvents()).toEqual([]);
  });

  it("reports a win_target challenge complete, timed to its targetCount-th win event", () => {
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("carol", 110);
    recordChallengeWinEvent("dave", 120);
    recordChallengeWinEvent("carol", 130);
    recordChallengeWinEvent("carol", 140);
    recordChallengeWinEvent("carol", 150);

    const events = buildCompletedGroupChallengeEvents();
    expect(events).toEqual([
      {
        challengeId: "challenge-2",
        title: "Win 5 rebuttal exercises",
        completedAt: 150,
        completedCount: 5,
        targetCount: 5,
        mvpContributorId: "carol",
        memberIds: ["carol", "dave"],
      },
    ]);
  });

  it("carries the challenge's own roster on every event, for roster-scoped digest filtering", () => {
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(
      makeContribution({ id: "c1", contributorId: "alice", kind: "card", argBlock: "solvency", submittedAt: 100 }),
    );
    saveContribution(
      makeContribution({ id: "c2", contributorId: "bob", kind: "card", argBlock: "solvency", submittedAt: 200 }),
    );

    const events = buildCompletedGroupChallengeEvents();
    expect(events[0].memberIds).toEqual(["alice", "bob"]);
  });

  it("reports a contribution_target challenge complete, timed to its targetCount-th contribution", () => {
    saveGroupChallenge(SOLVENCY_CHALLENGE);
    saveContribution(
      makeContribution({ id: "c1", contributorId: "alice", kind: "card", argBlock: "solvency", submittedAt: 100 }),
    );
    saveContribution(
      makeContribution({ id: "c2", contributorId: "bob", kind: "card", argBlock: "solvency", submittedAt: 200 }),
    );

    const events = buildCompletedGroupChallengeEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ challengeId: "challenge-1", completedAt: 200, completedCount: 2, targetCount: 2 });
  });

  it("sorts newest completion first", () => {
    // Both challenges share the same roster/window and every win event, but need a
    // different number of them — so they complete at different timestamps.
    const earlyWinChallenge = { ...REBUTTAL_CHALLENGE, id: "challenge-early", goal: { kind: "win_target" as const, targetCount: 1 } };
    const lateWinChallenge = { ...REBUTTAL_CHALLENGE, id: "challenge-late", goal: { kind: "win_target" as const, targetCount: 2 } };
    saveGroupChallenge(earlyWinChallenge);
    saveGroupChallenge(lateWinChallenge);
    recordChallengeWinEvent("carol", 110);
    recordChallengeWinEvent("dave", 190);

    const events = buildCompletedGroupChallengeEvents();
    expect(events.map((e) => ({ challengeId: e.challengeId, completedAt: e.completedAt }))).toEqual([
      { challengeId: "challenge-late", completedAt: 190 },
      { challengeId: "challenge-early", completedAt: 110 },
    ]);
  });
});
