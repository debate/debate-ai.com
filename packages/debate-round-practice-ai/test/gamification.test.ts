/**
 * Guards the port of Go `updateGamificationAfterBotDebate` and
 * `checkAndAwardAutomaticBadges`.
 */
import { describe, expect, it } from "vitest"
import { computeGamificationAward, pointsForResult } from "../src/backend/gamification"

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
