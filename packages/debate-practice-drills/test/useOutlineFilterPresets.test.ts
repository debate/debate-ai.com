import { describe, expect, it } from "vitest";
import { isOutlineFilterPresetsLiveUpdateStorageEvent } from "../src/hooks/useOutlineFilterPresets";

describe("isOutlineFilterPresetsLiveUpdateStorageEvent", () => {
  it("is true for the outline-filter-presets storage key", () => {
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: "outline-filter-presets" })).toBe(true);
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: "argumentTrees" })).toBe(false);
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: "argumentTreeFilters" })).toBe(false);
  });

  it("is false for a key that merely contains the tracked store name as a substring", () => {
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: "old_outline-filter-presets" })).toBe(false);
    expect(isOutlineFilterPresetsLiveUpdateStorageEvent({ key: "outline-filter-presets-backup" })).toBe(false);
  });
});
