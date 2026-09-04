import { describe, expect, it } from "vitest";
import type { GroupChallengeProgress } from "debate-team-collaboration/src/lib/group-challenges";
import type { CompletedGroupChallengeEvent } from "debate-team-collaboration/src/state/challengeWinEvents";
import {
  buildCoachingProgramChallengeDigest,
  buildCoachingProgramRosterAnalytics,
  buildRosterMemberAnalyticsSummaryText,
  summarizeMemberChallengeStanding,
  type CoachingProgramRosterMemberAnalytics,
} from "../src/lib/coaching-program-roster-analytics";
import type { DailyMissionResult } from "../src/lib/gamified-quests";

function challenge(overrides: Partial<GroupChallengeProgress>): GroupChallengeProgress {
  return {
    challengeId: "c1",
    title: "Find 20 solvency cards",
    targetCount: 20,
    completedCount: 0,
    remainingCount: 20,
    isComplete: false,
    hasEnded: false,
    daysRemaining: 3,
    memberStandings: [],
    ...overrides,
  };
}

describe("summarizeMemberChallengeStanding", () => {
  it("returns all-zero standing when the roster has no challenges", () => {
    expect(summarizeMemberChallengeStanding("alice", [])).toEqual({
      challengesParticipated: 0,
      challengesCompleted: 0,
      challengesLeading: 0,
      totalMatchingCount: 0,
    });
  });

  it("ignores a challenge the contributor isn't scoped to", () => {
    const board = [challenge({ memberStandings: [{ contributorId: "bob", matchingCount: 5 }] })];
    expect(summarizeMemberChallengeStanding("alice", board)).toEqual({
      challengesParticipated: 0,
      challengesCompleted: 0,
      challengesLeading: 0,
      totalMatchingCount: 0,
    });
  });

  it("counts a challenge the contributor is scoped to, even with zero matching activity", () => {
    const board = [challenge({ memberStandings: [{ contributorId: "alice", matchingCount: 0 }] })];
    expect(summarizeMemberChallengeStanding("alice", board)).toEqual({
      challengesParticipated: 1,
      challengesCompleted: 0,
      challengesLeading: 0,
      totalMatchingCount: 0,
    });
  });

  it("marks a challenge completed and led when the contributor is the MVP of a finished challenge", () => {
    const board = [
      challenge({
        isComplete: true,
        mvpContributorId: "alice",
        memberStandings: [
          { contributorId: "alice", matchingCount: 12 },
          { contributorId: "bob", matchingCount: 8 },
        ],
      }),
    ];
    expect(summarizeMemberChallengeStanding("alice", board)).toEqual({
      challengesParticipated: 1,
      challengesCompleted: 1,
      challengesLeading: 1,
      totalMatchingCount: 12,
    });
    expect(summarizeMemberChallengeStanding("bob", board)).toEqual({
      challengesParticipated: 1,
      challengesCompleted: 1,
      challengesLeading: 0,
      totalMatchingCount: 8,
    });
  });

  it("sums matching counts and leading counts across multiple challenges", () => {
    const board = [
      challenge({
        challengeId: "c1",
        mvpContributorId: "alice",
        memberStandings: [{ contributorId: "alice", matchingCount: 5 }],
      }),
      challenge({
        challengeId: "c2",
        isComplete: true,
        mvpContributorId: "alice",
        memberStandings: [{ contributorId: "alice", matchingCount: 7 }],
      }),
    ];
    expect(summarizeMemberChallengeStanding("alice", board)).toEqual({
      challengesParticipated: 2,
      challengesCompleted: 1,
      challengesLeading: 2,
      totalMatchingCount: 12,
    });
  });
});

describe("buildCoachingProgramRosterAnalytics", () => {
  it("returns an empty roster for an empty member list", () => {
    expect(buildCoachingProgramRosterAnalytics([], [], () => [], "2026-08-16")).toEqual([]);
  });

  it("builds one row per member, composing their challenge standing and quest streak", () => {
    const board = [
      challenge({
        isComplete: true,
        mvpContributorId: "alice",
        memberStandings: [{ contributorId: "alice", matchingCount: 3 }],
      }),
    ];
    const missionResults: Record<string, DailyMissionResult[]> = {
      alice: [
        { dayKey: "2026-08-14", isComplete: true },
        { dayKey: "2026-08-15", isComplete: true },
        { dayKey: "2026-08-16", isComplete: true },
      ],
      bob: [],
    };

    const roster = buildCoachingProgramRosterAnalytics(
      ["alice", "bob"],
      board,
      (contributorId) => missionResults[contributorId] ?? [],
      "2026-08-16",
    );

    const alice = roster.find((row) => row.contributorId === "alice")!;
    expect(alice.challengeStanding.challengesCompleted).toBe(1);
    expect(alice.challengeStanding.challengesLeading).toBe(1);
    expect(alice.questStreak.streak.currentStreak).toBe(3);
    expect(alice.questStreak.earnedBadges).toEqual(["3-Day Streak"]);

    const bob = roster.find((row) => row.contributorId === "bob")!;
    expect(bob.challengeStanding.challengesParticipated).toBe(0);
    expect(bob.questStreak.streak.currentStreak).toBe(0);
  });

  it("sorts by total matching count first, then current streak, then contributorId", () => {
    const board = [
      challenge({
        memberStandings: [
          { contributorId: "alice", matchingCount: 2 },
          { contributorId: "bob", matchingCount: 9 },
          { contributorId: "carol", matchingCount: 2 },
        ],
      }),
    ];
    const missionResults: Record<string, DailyMissionResult[]> = {
      alice: [{ dayKey: "2026-08-16", isComplete: true }],
      carol: [],
    };

    const roster = buildCoachingProgramRosterAnalytics(
      ["alice", "bob", "carol"],
      board,
      (contributorId) => missionResults[contributorId] ?? [],
      "2026-08-16",
    );

    expect(roster.map((row) => row.contributorId)).toEqual(["bob", "alice", "carol"]);
  });

  it("supports a custom streak-milestone list", () => {
    const missionResults: DailyMissionResult[] = [{ dayKey: "2026-08-16", isComplete: true }];
    const roster = buildCoachingProgramRosterAnalytics(
      ["alice"],
      [],
      () => missionResults,
      "2026-08-16",
      [{ streakLength: 1, badge: "First Day" }],
    );
    expect(roster[0].questStreak.earnedBadges).toEqual(["First Day"]);
  });
});

describe("buildCoachingProgramChallengeDigest", () => {
  function completedEvent(overrides: Partial<CompletedGroupChallengeEvent>): CompletedGroupChallengeEvent {
    return {
      challengeId: "c1",
      title: "Win 3 rebuttal exercises",
      completedAt: 100,
      completedCount: 3,
      targetCount: 3,
      memberIds: ["alice", "bob"],
      ...overrides,
    };
  }

  it("returns an empty digest for an empty roster or event list", () => {
    expect(buildCoachingProgramChallengeDigest([], [])).toEqual([]);
    expect(buildCoachingProgramChallengeDigest(["alice"], [])).toEqual([]);
    expect(buildCoachingProgramChallengeDigest([], [completedEvent({})])).toEqual([]);
  });

  it("includes an event whose roster overlaps the program roster", () => {
    const event = completedEvent({ memberIds: ["alice", "bob"] });
    expect(buildCoachingProgramChallengeDigest(["alice", "carol"], [event])).toEqual([event]);
  });

  it("excludes an event whose roster has no member in common with the program roster", () => {
    const event = completedEvent({ memberIds: ["dave", "eve"] });
    expect(buildCoachingProgramChallengeDigest(["alice", "bob"], [event])).toEqual([]);
  });

  it("filters a mixed list down to just the overlapping events, preserving input order", () => {
    const varsityWin = completedEvent({ challengeId: "varsity-win", memberIds: ["alice", "bob"], completedAt: 300 });
    const jvWin = completedEvent({ challengeId: "jv-win", memberIds: ["carol", "dave"], completedAt: 200 });
    const varsityCards = completedEvent({ challengeId: "varsity-cards", memberIds: ["bob"], completedAt: 100 });

    expect(buildCoachingProgramChallengeDigest(["alice", "bob"], [varsityWin, jvWin, varsityCards])).toEqual([
      varsityWin,
      varsityCards,
    ]);
  });
});

describe("buildRosterMemberAnalyticsSummaryText", () => {
  function analytics(overrides: Partial<CoachingProgramRosterMemberAnalytics>): CoachingProgramRosterMemberAnalytics {
    return {
      contributorId: "alice",
      challengeStanding: { challengesParticipated: 0, challengesCompleted: 0, challengesLeading: 0, totalMatchingCount: 0 },
      questStreak: { contributorId: "alice", streak: { currentStreak: 0, longestStreak: 0, lastCompletedDayKey: null }, earnedBadges: [] },
      ...overrides,
    };
  }

  it("reports no challenge activity when the member isn't scoped to any challenge", () => {
    expect(buildRosterMemberAnalyticsSummaryText(analytics({}))).toContain("no group challenges yet");
  });

  it("reports completed/participated counts, without a leading mention when not leading any", () => {
    const text = buildRosterMemberAnalyticsSummaryText(
      analytics({
        challengeStanding: { challengesParticipated: 2, challengesCompleted: 1, challengesLeading: 0, totalMatchingCount: 5 },
      }),
    );
    expect(text).toContain("1/2 challenges completed");
    expect(text).not.toContain("leading");
  });

  it("mentions how many challenges the member is leading when leading at least one", () => {
    const text = buildRosterMemberAnalyticsSummaryText(
      analytics({
        challengeStanding: { challengesParticipated: 2, challengesCompleted: 1, challengesLeading: 1, totalMatchingCount: 5 },
      }),
    );
    expect(text).toContain("leading 1");
  });
});
