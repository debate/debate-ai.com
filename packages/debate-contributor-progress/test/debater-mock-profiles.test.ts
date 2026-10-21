import { describe, expect, it } from "vitest";
import { computeLevelProgress, getChallengeProgress, utcDayKeyFor } from "../src/lib/debater-levels";
import { buildDebaterMockProfiles } from "../src/lib/debater-mock-profiles";

const NOW = Date.parse("2026-10-21T15:00:00Z");

describe("buildDebaterMockProfiles", () => {
  const profiles = buildDebaterMockProfiles(NOW);

  it("builds novice, JV and varsity profiles with rising levels", () => {
    expect(profiles.map((profile) => profile.id)).toEqual(["mock-novice", "mock-jv", "mock-varsity"]);
    const levels = profiles.map((profile) => computeLevelProgress(profile.state.totalXp).level);
    expect(levels[0]).toBeLessThan(levels[1]);
    expect(levels[1]).toBeLessThan(levels[2]);
  });

  it("gives every profile a mix of earned and partly-complete challenges", () => {
    for (const profile of profiles) {
      const progress = getChallengeProgress(profile.state, utcDayKeyFor(NOW));
      expect(progress.some((entry) => entry.isComplete)).toBe(true);
      expect(progress.some((entry) => !entry.isComplete && entry.current > 0)).toBe(true);
    }
  });

  it("dates today's activity to today and nothing in the future", () => {
    for (const profile of profiles) {
      expect(profile.state.daily.dayKey).toBe(utcDayKeyFor(NOW));
      expect(profile.state.recentXp.every((event) => event.atMs <= NOW)).toBe(true);
      expect(profile.judgeAwards.every((award) => award.debaterId === profile.id && award.awardedAt <= NOW)).toBe(true);
    }
  });

  it("keeps judge awards to one per award per judge per tournament", () => {
    for (const profile of profiles) {
      const slots = profile.judgeAwards.map((award) => `${award.judgeName}|${award.tournament}|${award.kind}`);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });
});
