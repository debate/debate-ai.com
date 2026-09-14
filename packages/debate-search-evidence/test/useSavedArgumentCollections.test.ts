import { describe, expect, it } from "vitest";
import { isSavedArgumentCollectionsLiveUpdateStorageEvent } from "../src/hooks/useSavedArgumentCollections";

describe("isSavedArgumentCollectionsLiveUpdateStorageEvent", () => {
  it("is true for the saved-argument-collections storage key", () => {
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: "saved-argument-collections" })).toBe(true);
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: "outline-filter-presets" })).toBe(false);
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: "evidenceLibraryEntries" })).toBe(false);
  });

  it("is false for a key that merely contains the tracked store name as a substring", () => {
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: "old_saved-argument-collections" })).toBe(false);
    expect(isSavedArgumentCollectionsLiveUpdateStorageEvent({ key: "saved-argument-collections-backup" })).toBe(
      false,
    );
  });
});
