import { describe, expect, it } from "vitest";
import {
  DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS,
  isDailyBestCardLiveUpdateStorageEvent,
} from "../src/state/live-update";

describe("isDailyBestCardLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isDailyBestCardLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isDailyBestCardLiveUpdateStorageEvent({ key: "old_dailyBestCardAnnouncements" })).toBe(false);
  });
});
