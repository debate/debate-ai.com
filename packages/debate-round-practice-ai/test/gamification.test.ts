/**
 * Guards the port of Go `updateGamificationAfterBotDebate` and
 * `checkAndAwardAutomaticBadges`.
 */
import { describe, expect, it } from "vitest"
import { advanceDailyStreak, computeGamificationAward, currentDisplayStreak, pointsForResult, utcDayKey } from "../src/backend/gamification"

const profile = (over: Partial<{ score: number; badges: string[]; currentStreak: number }> = {}) => ({
  score: 0,
  badges: [] as string[],
  currentStreak: 0,
  ...over,
})

describe("pointsForResult", () => {
  it("keeps the Go point values", () => {
    expect(pointsForResult("win")).toEqual({ points: 50, action: "debate_win" })
    expect(pointsForResult("loss")).toEqual({ points: 10, action: "debate_loss" })
    expect(pointsForResult("draw")).toEqual({ points: 25, action: "debate_complete" })
    expect(pointsForResult("pending")).toEqual({ points: 10, action: "debate_complete" })
  })
})

describe("computeGamificationAward", () => {
  it("awards FirstWin and Novice on a first win", () => {
    const award = computeGamificationAward(profile(), "win")
    expect(award.newScore).toBe(50)
    expect(award.badgesAwarded).toEqual(["FirstWin", "Novice"])
  })

  it("never re-awards a badge the user already holds", () => {
    const award = computeGamificationAward(profile({ score: 200, badges: ["FirstWin", "Novice"] }), "win")
    expect(award.badgesAwarded).toEqual([])
  })

  it("awards Streak5 at a five-day streak", () => {
    expect(computeGamificationAward(profile({ currentStreak: 5 }), "loss").badgesAwarded).toContain(
      "Streak5",
    )
    expect(
      computeGamificationAward(profile({ currentStreak: 4 }), "loss").badgesAwarded,
    ).not.toContain("Streak5")
  })

  it("awards FactMaster once the post-round score clears 500", () => {
    expect(computeGamificationAward(profile({ score: 460 }), "win").badgesAwarded).toContain(
      "FactMaster",
    )
    expect(computeGamificationAward(profile({ score: 400 }), "win").badgesAwarded).not.toContain(
      "FactMaster",
    )
  })

  it("treats a negative stored score as zero, as the Go code did", () => {
    expect(computeGamificationAward(profile({ score: -20 }), "loss").newScore).toBe(10)
  })
})

describe("utcDayKey", () => {
  it("formats an epoch timestamp as a UTC YYYY-MM-DD key", () => {
    expect(utcDayKey(Date.UTC(2026, 0, 5, 23, 59, 59))).toBe("2026-01-05")
  })
})

describe("advanceDailyStreak", () => {
  it("starts a streak at 1 for the first round ever", () => {
    expect(advanceDailyStreak(null, "2026-01-01", 0)).toBe(1)
    expect(advanceDailyStreak(undefined, "2026-01-01", 0)).toBe(1)
  })

  it("leaves the streak unchanged for a second round the same day", () => {
    expect(advanceDailyStreak("2026-01-05", "2026-01-05", 3)).toBe(3)
  })

  it("extends the streak by one on the very next calendar day", () => {
    expect(advanceDailyStreak("2026-01-05", "2026-01-06", 3)).toBe(4)
  })

  it("restarts the streak at 1 after a missed day", () => {
    expect(advanceDailyStreak("2026-01-01", "2026-01-05", 4)).toBe(1)
  })

  it("carries a streak across a UTC month boundary", () => {
    expect(advanceDailyStreak("2026-01-31", "2026-02-01", 2)).toBe(3)
  })
})

describe("currentDisplayStreak", () => {
  it("holds the stored streak while the last play was today", () => {
    expect(currentDisplayStreak("2026-01-05", "2026-01-05", 5)).toBe(5)
  })

  it("holds the stored streak while the last play was yesterday (not yet lapsed)", () => {
    expect(currentDisplayStreak("2026-01-04", "2026-01-05", 5)).toBe(5)
  })

  it("reports 0 once a day has been missed, without needing a write to reset it", () => {
    expect(currentDisplayStreak("2026-01-01", "2026-01-05", 5)).toBe(0)
  })

  it("reports 0 when nothing has ever been played", () => {
    expect(currentDisplayStreak(null, "2026-01-05", 0)).toBe(0)
  })
})
