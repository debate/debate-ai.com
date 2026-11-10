/**
 * @fileoverview Online Challenge rewards: XP per round, the win-streak boost,
 * trophies, and the Debater Level activities a reward turns into.
 */

import { describe, expect, it } from "vitest";

import {
  ACTIVITY_XP,
} from "@debate-ai/community/src/lib/debater-levels";
import {
  CHALLENGE_PLAYED_XP,
  CHALLENGE_WIN_XP,
  boostForStreak,
  formatBoost,
  rewardActivities,
  summarizeChallenges,
  type FinishedChallenge,
} from "../../src/debate-challenges/rewards";

let seq = 0;
function result(won: boolean, extra: Partial<FinishedChallenge> = {}): FinishedChallenge {
  seq += 1;
  return {
    id: `c${seq}`,
    format: "pf",
    vsAi: false,
    aiLevel: null,
    viewerSide: "aff",
    winnerSide: won ? "aff" : "neg",
    decisionMethod: "judge",
    completedAt: 1000 + seq,
    claimed: false,
    ...extra,
  };
}

describe("boostForStreak", () => {
  it("grows with the streak: 1×, 1.5×, 2×, 3×", () => {
    expect([1, 2, 3, 4, 5, 9].map(boostForStreak)).toEqual([1, 1.5, 2, 2, 3, 3]);
  });
});

describe("summarizeChallenges", () => {
  it("pays the round, the win, and the boost of the streak each win extended", () => {
    const rounds = [result(true), result(true), result(true), result(false), result(true)];
    const { stats, rewards } = summarizeChallenges(rounds);
    expect(rounds.map((round) => rewards.get(round.id)?.boost)).toEqual([1, 1.5, 2, 1, 1]);
    expect(rewards.get(rounds[1].id)?.xp).toBe(CHALLENGE_PLAYED_XP + CHALLENGE_WIN_XP * 1.5);
    expect(rewards.get(rounds[3].id)).toMatchObject({ xp: CHALLENGE_PLAYED_XP, won: false });
    expect(stats).toMatchObject({ played: 5, wins: 4, losses: 1, currentStreak: 1, bestStreak: 3, nextBoost: 1.5 });
  });

  it("works rewards out oldest first, whatever order the rows come in", () => {
    const rounds = [result(true), result(true)];
    const { rewards } = summarizeChallenges([...rounds].reverse());
    expect(rewards.get(rounds[0].id)?.boost).toBe(1);
    expect(rewards.get(rounds[1].id)?.boost).toBe(1.5);
  });

  it("pays nothing for losing on a forfeit", () => {
    const round = result(false, { decisionMethod: "forfeit" });
    expect(summarizeChallenges([round]).rewards.get(round.id)?.xp).toBe(0);
  });

  it("awards trophies for milestones", () => {
    const wins = Array.from({ length: 5 }, () => result(true));
    const ai = result(true, { vsAi: true, aiLevel: "champion", format: "ld" });
    const policy = result(true, { format: "policy" });
    const earned = summarizeChallenges([...wins, ai, policy])
      .trophies.filter((trophy) => trophy.earned)
      .map((trophy) => trophy.id);
    expect(earned).toEqual(
      expect.arrayContaining(["first-win", "hat-trick", "on-fire", "beat-the-ai", "format-master", "all-rounder", "people-person"]),
    );
    expect(earned).not.toContain("ten-wins");
  });

  it("starts with an empty trophy case", () => {
    const { trophies, stats } = summarizeChallenges([]);
    expect(trophies.every((trophy) => !trophy.earned)).toBe(true);
    expect(stats.nextBoost).toBe(1);
  });
});

describe("rewardActivities", () => {
  it("adds up to the reward's XP at the Debater Level rates", () => {
    for (const boost of [1, 1.5, 2, 3]) {
      const xp = CHALLENGE_PLAYED_XP + CHALLENGE_WIN_XP * boost;
      const total = rewardActivities({ xp, won: true, boost }).reduce(
        (sum, activity) => sum + ACTIVITY_XP[activity.kind] * activity.count,
        0,
      );
      expect(total).toBe(xp);
    }
    expect(rewardActivities({ xp: CHALLENGE_PLAYED_XP, won: false, boost: 1 })).toEqual([{ kind: "challenge_played", count: 1 }]);
    expect(rewardActivities({ xp: 0, won: false, boost: 1 })).toEqual([]);
  });
});

describe("formatBoost", () => {
  it("names a boost", () => {
    expect(formatBoost(1.5)).toBe("1.5×");
    expect(formatBoost(2)).toBe("2×");
  });
});
