/**
 * @fileoverview Post-round scoring — the port of
 * `updateGamificationAfterBotDebate` and `checkAndAwardAutomaticBadges` in
 * Go `backend/controllers/debatevsbot_controller.go`.
 *
 * The Go versions were Mongo writes with the award rules tangled into them.
 * Here the rules are pure functions over a profile snapshot: they say what
 * *should* be awarded, and the host app's `DebateStore` decides how to
 * persist it. Same point values, same badge thresholds, same action labels.
 *
 * @module backend/gamification
 */

import type { DebateResultStatus } from "./types"

/** A user's gamification state, as the Go code read it off `models.User`. */
export interface GamificationProfile {
  score: number
  badges: string[]
  currentStreak: number
}

/** What a finished round earns. Fed to the store as one atomic update. */
export interface GamificationAward {
  /** Points to add to the user's score. */
  points: number
  /** The score-update action label the Go code wrote to `score_updates`. */
  action: string
  /** Badges to grant that the user does not already hold. */
  badgesAwarded: string[]
  /** The score the user ends the round on. */
  newScore: number
}

/**
 * Points and action label per result. Ported from the Go `switch
 * resultStatus`: a win over a bot is 50, a draw 25, and a loss still earns
 * the 10 participation points — as does any unrecognised status.
 */
export function pointsForResult(resultStatus: DebateResultStatus): { points: number; action: string } {
  switch (resultStatus) {
    case "win":
      return { points: 50, action: "debate_win" }
    case "loss":
      return { points: 10, action: "debate_loss" }
    case "draw":
      return { points: 25, action: "debate_complete" }
    default:
      return { points: 10, action: "debate_complete" }
  }
}

/**
 * Compute a round's award without writing anything. Ported from the Go
 * controller's badge checks, in the same order: `FirstWin` for a first win
 * over a bot, then the automatic badges — `Novice` at 10 points, `Streak5`
 * at a 5-day streak, `FactMaster` at 500 points.
 *
 * As in Go, a negative stored score is treated as zero rather than carried.
 */
export function computeGamificationAward(
  profile: GamificationProfile,
  resultStatus: DebateResultStatus,
): GamificationAward {
  const { points, action } = pointsForResult(resultStatus)
  const startingScore = Math.max(0, profile.score)
  const newScore = startingScore + points

  const held = new Set(profile.badges)
  const badgesAwarded: string[] = []
  const award = (badge: string) => {
    if (!held.has(badge)) {
      held.add(badge)
      badgesAwarded.push(badge)
    }
  }

  if (resultStatus === "win") award("FirstWin")
  // The Go `checkAndAwardAutomaticBadges` ran against the post-increment
  // user document, so the new score is what clears these thresholds.
  if (newScore >= 10) award("Novice")
  if (profile.currentStreak >= 5) award("Streak5")
  if (newScore >= 500) award("FactMaster")

  return { points, action, badgesAwarded, newScore }
}

/** The UTC calendar day, as a "YYYY-MM-DD" key, one round's clock landed on. */
export function utcDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

function dayBeforeKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * Advance a day-over-day play streak on a finished round. The Go server's
 * `CurrentStreak` field was read by `checkAndAwardAutomaticBadges` but never
 * actually incremented anywhere in `debatevsbot_controller.go`, so `Streak5`
 * was unreachable there too — this is the real implementation that gap
 * always assumed existed.
 *
 * A second round the same calendar day as the last one leaves the streak
 * unchanged (it doesn't take multiple rounds in one day to keep it alive,
 * nor does a second round advance it further); the day immediately after
 * extends it by one; anything else — the first round ever, or a day missed
 * in between — restarts it at 1.
 */
export function advanceDailyStreak(
  lastPlayedDayKey: string | null | undefined,
  today: string,
  previousStreak: number,
): number {
  if (lastPlayedDayKey === today) return Math.max(1, previousStreak)
  if (lastPlayedDayKey === dayBeforeKey(today)) return Math.max(0, previousStreak) + 1
  return 1
}

/**
 * The streak to report without recording a new round (`getGamificationProfile`):
 * holds while the last play was today or yesterday, and reads as 0 once a
 * day has been missed, even though the stored counter itself is only reset
 * by the next `advanceDailyStreak` call rather than by the passage of time.
 */
export function currentDisplayStreak(
  lastPlayedDayKey: string | null | undefined,
  today: string,
  storedStreak: number,
): number {
  if (lastPlayedDayKey === today || lastPlayedDayKey === dayBeforeKey(today)) return storedStreak
  return 0
}
