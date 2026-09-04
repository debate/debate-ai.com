import { beforeEach, describe, expect, it } from "vitest";
import { buildPersistedCoachingProgramRosterAnalytics } from "../src/state/coachingProgramRosterAnalytics";
import { saveDailyMissionResult } from "../src/state/dailyMissionResults";
import { saveCoachingProgram } from "debate-team-collaboration/src/state/coachingPrograms";
import { saveGroupChallenge } from "debate-team-collaboration/src/state/groupChallenges";
import { recordChallengeWinEvent } from "debate-team-collaboration/src/state/challengeWinEvents";
import type { CoachingProgramConfig } from "debate-team-collaboration/src/round/coaching-program";
import type { GroupChallenge } from "debate-team-collaboration/src/lib/group-challenges";

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

const VARSITY: CoachingProgramConfig = { id: "varsity", name: "Varsity Squad", memberIds: ["alice", "bob"] };

const REBUTTAL_CHALLENGE: GroupChallenge = {
  id: "challenge-1",
  title: "Win 3 rebuttal exercises",
  goal: { kind: "win_target", targetCount: 3 },
  memberIds: ["alice", "bob"],
  startsAt: 0,
  endsAt: 1_000_000,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("buildPersistedCoachingProgramRosterAnalytics", () => {
  it("returns undefined for a programId with no stored config", () => {
    expect(buildPersistedCoachingProgramRosterAnalytics("missing", Date.now())).toBeUndefined();
  });

  it("returns one row per roster member, even with no persisted activity yet", () => {
    saveCoachingProgram(VARSITY);
    const roster = buildPersistedCoachingProgramRosterAnalytics("varsity", Date.now());

    expect(roster).toHaveLength(2);
    expect(roster!.map((row) => row.contributorId).sort()).toEqual(["alice", "bob"]);
    expect(roster!.every((row) => row.challengeStanding.challengesParticipated === 0)).toBe(true);
    expect(roster!.every((row) => row.questStreak.streak.currentStreak === 0)).toBe(true);
  });

  it("composes the real, persisted group-challenge board and mission-result history for each member", () => {
    saveCoachingProgram(VARSITY);
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("alice", 100);
    recordChallengeWinEvent("alice", 200);
    recordChallengeWinEvent("alice", 300);
    recordChallengeWinEvent("bob", 100);
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-15", isComplete: true });
    saveDailyMissionResult({ contributorId: "alice", dayKey: "2026-08-16", isComplete: true });

    const roster = buildPersistedCoachingProgramRosterAnalytics("varsity", Date.UTC(2026, 7, 16, 12, 0, 0));
    const alice = roster!.find((row) => row.contributorId === "alice")!;
    const bob = roster!.find((row) => row.contributorId === "bob")!;

    expect(alice.challengeStanding.challengesParticipated).toBe(1);
    expect(alice.challengeStanding.challengesCompleted).toBe(1);
    expect(alice.challengeStanding.challengesLeading).toBe(1);
    expect(alice.challengeStanding.totalMatchingCount).toBe(3);
    expect(alice.questStreak.streak.currentStreak).toBe(2);

    expect(bob.challengeStanding.challengesParticipated).toBe(1);
    expect(bob.challengeStanding.challengesLeading).toBe(0);
    expect(bob.challengeStanding.totalMatchingCount).toBe(1);
    expect(bob.questStreak.streak.currentStreak).toBe(0);
  });

  it("scopes challenge standings to the program's own roster, ignoring a member outside it", () => {
    saveCoachingProgram({ id: "jv", name: "JV Squad", memberIds: ["carol"] });
    saveGroupChallenge(REBUTTAL_CHALLENGE);
    recordChallengeWinEvent("alice", 100);

    const roster = buildPersistedCoachingProgramRosterAnalytics("jv", Date.now());
    expect(roster).toHaveLength(1);
    expect(roster![0].contributorId).toBe("carol");
    expect(roster![0].challengeStanding.challengesParticipated).toBe(0);
  });
});
