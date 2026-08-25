import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS,
  DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS,
  TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS,
  isContributionLeaderboardLiveUpdateStorageEvent,
  isDailyBestCardLiveUpdateStorageEvent,
  isTaskInboxLiveUpdateStorageEvent,
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

describe("isContributionLeaderboardLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isContributionLeaderboardLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "contributionsBackup" })).toBe(false);
    expect(isContributionLeaderboardLiveUpdateStorageEvent({ key: "old_dailyMissionResults" })).toBe(false);
  });
});

describe("isTaskInboxLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isTaskInboxLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "routedTaskQueuesBackup" })).toBe(false);
    expect(isTaskInboxLiveUpdateStorageEvent({ key: "old_trackedArguments" })).toBe(false);
  });
});
