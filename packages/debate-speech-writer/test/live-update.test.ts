import { describe, expect, it } from "vitest";
import {
  JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS,
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
