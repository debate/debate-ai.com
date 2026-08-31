import { describe, expect, it } from "vitest";
import {
  FLOW_ANNOTATIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  FLOW_LIVE_UPDATE_STORAGE_KEYS,
  isFlowAnnotationsPanelLiveUpdateStorageEvent,
  isFlowLiveUpdateStorageEvent,
} from "../src/flow/live-update";

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

describe("isFlowAnnotationsPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of FLOW_ANNOTATIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key: "flowEdits" })).toBe(false);
    expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key: "prepNotes" })).toBe(false);
  });

  it("is false for a key that merely contains the store name as a substring", () => {
    expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key: "flowAnnotationsBackup" })).toBe(false);
    expect(isFlowAnnotationsPanelLiveUpdateStorageEvent({ key: "old_flowAnnotations" })).toBe(false);
  });
});
