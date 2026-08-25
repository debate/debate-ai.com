import { describe, expect, it } from "vitest";
import { FLOW_LIVE_UPDATE_STORAGE_KEYS, isFlowLiveUpdateStorageEvent } from "../src/flow/live-update";

describe("isFlowLiveUpdateStorageEvent", () => {
  it("is true for every badge-backing store key", () => {
    for (const key of FLOW_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isFlowLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isFlowLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isFlowLiveUpdateStorageEvent({ key: "practiceRounds" })).toBe(false);
    expect(isFlowLiveUpdateStorageEvent({ key: "contributions" })).toBe(false);
  });

  it("is false for a key that merely contains a badge store name as a substring", () => {
    expect(isFlowLiveUpdateStorageEvent({ key: "flowAnnotationsBackup" })).toBe(false);
    expect(isFlowLiveUpdateStorageEvent({ key: "old_flowEdits" })).toBe(false);
  });
});
