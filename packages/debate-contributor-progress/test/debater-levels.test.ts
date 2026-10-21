import { describe, expect, it } from "vitest";
import {
  applyDebaterActivity,
  computeLevelProgress,
  createDebaterLevelState,
  getChallengeProgress,
  MAX_DEBATER_LEVEL,
  parseDebaterLevelState,
  rankTitleForLevel,
  totalXpForLevel,
  xpToAdvance,
} from "../src/lib/debater-levels";

const DAY1 = Date.parse("2026-09-26T12:00:00Z");
const DAY2 = Date.parse("2026-09-27T12:00:00Z");

describe("level curve", () => {
  it("costs 100 XP for level 2, then 50 more per level", () => {
    expect(xpToAdvance(1)).toBe(100);
    expect(xpToAdvance(2)).toBe(150);
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(3)).toBe(250);
  });

  it("resolves XP to a level and progress", () => {
    expect(computeLevelProgress(0)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100, title: "Novice" });
    expect(computeLevelProgress(99).level).toBe(1);
    expect(computeLevelProgress(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNextLevel: 150 });
    expect(computeLevelProgress(325)).toMatchObject({ level: 3, xpIntoLevel: 75, fraction: 0.375 });
  });

  it("caps at the max level", () => {
    const progress = computeLevelProgress(10_000_000);
    expect(progress).toMatchObject({ level: MAX_DEBATER_LEVEL, isMaxLevel: true, fraction: 1, title: "TOC Legend" });
    expect(computeLevelProgress(totalXpForLevel(MAX_DEBATER_LEVEL)).level).toBe(MAX_DEBATER_LEVEL);
  });

  it("titles ranks by level", () => {
    expect(rankTitleForLevel(4)).toBe("Novice");
    expect(rankTitleForLevel(5)).toBe("JV Debater");
    expect(rankTitleForLevel(12)).toBe("Varsity Debater");
  });
});

describe("applyDebaterActivity", () => {
  it("pays the 'Cut 5 cards' daily challenge once the fifth card is cut, and levels up", () => {
    let state = createDebaterLevelState();
    const first = applyDebaterActivity(state, "card_cut", DAY1);
    // 5 activity XP + 25 "First card" milestone.
    expect(first.xpGained).toBe(30);
    expect(first.completedChallenges.map((c) => c.id)).toEqual(["milestone-first-card"]);
    state = first.state;
    for (let i = 0; i < 3; i += 1) state = applyDebaterActivity(state, "card_cut", DAY1).state;
    const fifth = applyDebaterActivity(state, "card_cut", DAY1);
    expect(fifth.completedChallenges.map((c) => c.id)).toEqual(["daily-cut-5-cards"]);
    expect(fifth.xpGained).toBe(105);
    expect(fifth.state.totalXp).toBe(150);
    expect(fifth.leveledUp).toBe(true);
    expect(fifth.newLevel).toBe(2);
    // A sixth card the same day doesn't pay the daily bonus again.
    expect(applyDebaterActivity(fifth.state, "card_cut", DAY1).xpGained).toBe(5);
  });

  it("pays 'Redo a rebuttal' again the next day but milestones only once", () => {
    const day1 = applyDebaterActivity(createDebaterLevelState(), "rebuttal_redo", DAY1);
    expect(day1.xpGained).toBe(15 + 75);
    expect(applyDebaterActivity(day1.state, "rebuttal_redo", DAY1).xpGained).toBe(15);
    const day2 = applyDebaterActivity(day1.state, "rebuttal_redo", DAY2);
    expect(day2.xpGained).toBe(15 + 75);
    expect(day2.state.daily.dayKey).toBe("2026-09-27");
    expect(day2.state.lifetimeCounts.rebuttal_redo).toBe(2);
  });

  it("handles bulk counts and zero counts", () => {
    const bulk = applyDebaterActivity(createDebaterLevelState(), "card_cut", DAY1, 5);
    expect(bulk.xpGained).toBe(25 + 25 + 100);
    expect(bulk.state.recentXp.map((event) => event.label)).toContain("Cut a card ×5");
    const none = applyDebaterActivity(bulk.state, "card_cut", DAY1, 0);
    expect(none.xpGained).toBe(0);
    expect(none.state.totalXp).toBe(bulk.state.totalXp);
  });

  it("never mutates the input state", () => {
    const state = createDebaterLevelState("2026-09-26");
    const snapshot = JSON.stringify(state);
    applyDebaterActivity(state, "practice_round", DAY1);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("getChallengeProgress", () => {
  it("reads yesterday's daily counts as zero", () => {
    const { state } = applyDebaterActivity(createDebaterLevelState(), "card_cut", DAY1, 3);
    const today = getChallengeProgress(state, "2026-09-26").find((p) => p.challenge.id === "daily-cut-5-cards");
    expect(today).toMatchObject({ current: 3, isComplete: false });
    const tomorrow = getChallengeProgress(state, "2026-09-27").find((p) => p.challenge.id === "daily-cut-5-cards");
    expect(tomorrow).toMatchObject({ current: 0, isComplete: false });
    const milestone = getChallengeProgress(state, "2026-09-27").find((p) => p.challenge.id === "milestone-cards-50");
    expect(milestone?.current).toBe(3);
  });
});

describe("parseDebaterLevelState", () => {
  it("round-trips a valid state and rejects malformed ones", () => {
    const { state } = applyDebaterActivity(createDebaterLevelState(), "practice_win", DAY1);
    expect(parseDebaterLevelState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(parseDebaterLevelState(null)).toBeNull();
    expect(parseDebaterLevelState({ totalXp: -1 })).toBeNull();
    expect(parseDebaterLevelState({ ...state, lifetimeCounts: { bogus: 1 } })).toBeNull();
  });
});
