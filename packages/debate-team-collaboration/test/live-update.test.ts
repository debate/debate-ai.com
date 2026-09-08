import { describe, expect, it } from "vitest";
import {
  COACHING_PROGRAMS_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  isCoachingProgramsPanelLiveUpdateStorageEvent,
} from "../src/state/live-update";

describe("isCoachingProgramsPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads directly", () => {
    for (const key of COACHING_PROGRAMS_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key: "groupChallenges" })).toBe(false);
    expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key: "old_coachingPrograms" })).toBe(false);
    expect(isCoachingProgramsPanelLiveUpdateStorageEvent({ key: "roundContributorFlowsBackup" })).toBe(false);
  });
});
