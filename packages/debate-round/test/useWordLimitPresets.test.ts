import { describe, expect, it } from "vitest";
import { isWordLimitPresetsLiveUpdateStorageEvent } from "../src/hooks/useWordLimitPresets";

describe("isWordLimitPresetsLiveUpdateStorageEvent", () => {
  it("is true for the word-limit-presets storage key", () => {
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: "word-limit-presets" })).toBe(true);
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: "outline-filter-presets" })).toBe(false);
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: "wordCountRounds" })).toBe(false);
  });

  it("is false for a key that merely contains the tracked store name as a substring", () => {
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: "old_word-limit-presets" })).toBe(false);
    expect(isWordLimitPresetsLiveUpdateStorageEvent({ key: "word-limit-presets-backup" })).toBe(false);
  });
});
