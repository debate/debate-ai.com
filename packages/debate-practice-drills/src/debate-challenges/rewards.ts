/**
 * @fileoverview What Online Challenges pay: XP per round, a win-streak boost on
 * top of each win, and trophies for milestones.
 *
 * Pure. The API computes every number here from the viewer's finished
 * challenges (so a reload, or another device, sees the same record), and the
 * board turns a reward into Debater Level XP through {@link rewardActivities} —
 * the `challenge_*` activity kinds in `debate-community`'s `debater-levels.ts`,
 * whose flat XP values match the constants below.
 *
 * @module debate-practice-rounds/debate-challenges/rewards
 */

import type { ChallengeFormat, ChallengeReward, ChallengeSide, ChallengeStats, DecisionMethod, TrophyStatus } from "./types";

/** XP for finishing a challenge, win or lose (not for forfeiting one). */
export const CHALLENGE_PLAYED_XP = 20;
/** XP for a win, before the boost. */
export const CHALLENGE_WIN_XP = 40;
/** The boost is paid in units of this much XP (`challenge_boost`). */
export const CHALLENGE_BOOST_UNIT_XP = 10;

/**
 * The multiplier on a win's XP for the `streak`-th win in a row (this win
 * included): one win is plain, two in a row 1.5×, three or four 2×, five or
 * more 3×.
 */
export function boostForStreak(streak: number): number {
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

/** One finished challenge as the reward rules read it, from one debater's side. */
export interface FinishedChallenge {
  id: string;
  format: ChallengeFormat;
  vsAi: boolean;
  aiLevel: string | null;
  viewerSide: ChallengeSide;
  winnerSide: ChallengeSide;
  decisionMethod: DecisionMethod;
  /** Unix seconds; rewards are worked out in this order. */
  completedAt: number;
  /** Whether the viewer has already collected this one. */
  claimed: boolean;
}

/** The trophy case, in display order. */
export const TROPHIES: readonly { id: string; title: string; description: string; emoji: string }[] = [
  { id: "first-win", title: "First Victory", description: "Win your first online challenge.", emoji: "🥇" },
  { id: "iron-debater", title: "Iron Debater", description: "Finish 10 challenges.", emoji: "🛡️" },
  { id: "hat-trick", title: "Hat Trick", description: "Win 3 challenges in a row.", emoji: "🎩" },
  { id: "on-fire", title: "On Fire", description: "Win 5 challenges in a row.", emoji: "🔥" },
  { id: "ten-wins", title: "Contender", description: "Win 10 challenges.", emoji: "🏅" },
  { id: "twenty-five-wins", title: "Champion", description: "Win 25 challenges.", emoji: "🏆" },
  { id: "beat-the-ai", title: "Machine Breaker", description: "Beat the AI opponent on Champion level.", emoji: "🤖" },
  { id: "format-master", title: "Format Master", description: "Win 5 challenges in one format.", emoji: "🎯" },
  { id: "all-rounder", title: "All-Rounder", description: "Win in 3 different formats.", emoji: "🌐" },
  { id: "people-person", title: "Crowd Favorite", description: "Beat 5 other players.", emoji: "🤝" },
];

/** What {@link summarizeChallenges} returns. */
export interface ChallengeSummary {
  stats: ChallengeStats;
  trophies: TrophyStatus[];
  /** The viewer's reward for each finished challenge, by challenge id. */
  rewards: Map<string, ChallengeReward>;
}

/**
 * The viewer's record, trophies and per-challenge rewards. Finished challenges
 * are walked oldest first, so each win's boost is the streak it extended — a
 * reward never changes after the fact.
 *
 * Losing on a forfeit earns nothing (the point of the clock is to answer it);
 * any other finish earns {@link CHALLENGE_PLAYED_XP}, and a win adds
 * {@link CHALLENGE_WIN_XP} times the boost.
 */
export function summarizeChallenges(finished: readonly FinishedChallenge[]): ChallengeSummary {
  const ordered = [...finished].sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id));
  const rewards = new Map<string, ChallengeReward>();
  let wins = 0;
  let losses = 0;
  let streak = 0;
  let bestStreak = 0;
  let totalXp = 0;
  let championAiWins = 0;
  let playerWins = 0;
  const winsByFormat = new Map<ChallengeFormat, number>();

  for (const challenge of ordered) {
    const won = challenge.winnerSide === challenge.viewerSide;
    let boost = 1;
    let xp = 0;
    if (won) {
      wins += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      boost = boostForStreak(streak);
      xp = CHALLENGE_PLAYED_XP + Math.round(CHALLENGE_WIN_XP * boost);
      winsByFormat.set(challenge.format, (winsByFormat.get(challenge.format) ?? 0) + 1);
      if (challenge.vsAi && challenge.aiLevel === "champion") championAiWins += 1;
      if (!challenge.vsAi) playerWins += 1;
    } else {
      losses += 1;
      streak = 0;
      xp = challenge.decisionMethod === "forfeit" ? 0 : CHALLENGE_PLAYED_XP;
    }
    totalXp += xp;
    rewards.set(challenge.id, { xp, won, boost, claimed: challenge.claimed });
  }

  const played = ordered.length;
  const bestFormat = Math.max(0, ...winsByFormat.values());
  const earned = new Set<string>();
  if (wins >= 1) earned.add("first-win");
  if (played >= 10) earned.add("iron-debater");
  if (bestStreak >= 3) earned.add("hat-trick");
  if (bestStreak >= 5) earned.add("on-fire");
  if (wins >= 10) earned.add("ten-wins");
  if (wins >= 25) earned.add("twenty-five-wins");
  if (championAiWins >= 1) earned.add("beat-the-ai");
  if (bestFormat >= 5) earned.add("format-master");
  if (winsByFormat.size >= 3) earned.add("all-rounder");
  if (playerWins >= 5) earned.add("people-person");

  return {
    stats: {
      played,
      wins,
      losses,
      currentStreak: streak,
      bestStreak,
      nextBoost: boostForStreak(streak + 1),
      totalXp,
    },
    trophies: TROPHIES.map((trophy) => ({ ...trophy, earned: earned.has(trophy.id) })),
    rewards,
  };
}

/** One Debater Level activity to record. Kinds match `debate-community`'s `DebaterActivityKind`. */
export interface RewardActivity {
  kind: "challenge_played" | "challenge_won" | "challenge_boost";
  count: number;
}

/**
 * A reward as Debater Level activities: the round, the win, and the boost in
 * {@link CHALLENGE_BOOST_UNIT_XP} units. Their XP adds up to `reward.xp`.
 */
export function rewardActivities(reward: Pick<ChallengeReward, "xp" | "won" | "boost">): RewardActivity[] {
  if (reward.xp <= 0) return [];
  const out: RewardActivity[] = [{ kind: "challenge_played", count: 1 }];
  if (!reward.won) return out;
  out.push({ kind: "challenge_won", count: 1 });
  const boostXp = Math.round(CHALLENGE_WIN_XP * reward.boost) - CHALLENGE_WIN_XP;
  const units = Math.round(boostXp / CHALLENGE_BOOST_UNIT_XP);
  if (units > 0) out.push({ kind: "challenge_boost", count: units });
  return out;
}

/** How the board names a boost: "1.5×". */
export function formatBoost(boost: number): string {
  return `${Number.isInteger(boost) ? boost : boost.toFixed(1)}×`;
}
