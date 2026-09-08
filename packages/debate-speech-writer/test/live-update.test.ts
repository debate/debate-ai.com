import { describe, expect, it } from "vitest";
import {
  COACH_MATERIALS_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS,
  isCoachMaterialsPanelLiveUpdateStorageEvent,
  isJudgeProfilesLiveUpdateStorageEvent,
} from "../src/state/live-update";

describe("isJudgeProfilesLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isJudgeProfilesLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isJudgeProfilesLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isJudgeProfilesLiveUpdateStorageEvent({ key: "opponentTeamProfiles" })).toBe(false);
    expect(isJudgeProfilesLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isJudgeProfilesLiveUpdateStorageEvent({ key: "old_judgeProfiles" })).toBe(false);
    expect(isJudgeProfilesLiveUpdateStorageEvent({ key: "judgeRoundRecordsBackup" })).toBe(false);
  });
});

describe("isCoachMaterialsPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of COACH_MATERIALS_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key: "judgeProfiles" })).toBe(false);
    expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key: "old_coachMaterials" })).toBe(false);
    expect(isCoachMaterialsPanelLiveUpdateStorageEvent({ key: "coachMaterialVersionsBackup" })).toBe(false);
  });
});
