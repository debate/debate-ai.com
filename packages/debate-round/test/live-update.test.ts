import { describe, expect, it } from "vitest";
import {
  FLOW_ANNOTATIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  FLOW_LIVE_UPDATE_STORAGE_KEYS,
  PREP_NOTE_NOTIFICATIONS_LIVE_UPDATE_STORAGE_KEYS,
  PREP_NOTES_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  isFlowAnnotationsPanelLiveUpdateStorageEvent,
  isFlowLiveUpdateStorageEvent,
  isPrepNoteNotificationsLiveUpdateStorageEvent,
  isPrepNotesPanelLiveUpdateStorageEvent,
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

describe("isPrepNoteNotificationsLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of PREP_NOTE_NOTIFICATIONS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key, including the recipient-id key", () => {
    expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key: "prepNotes" })).toBe(false);
    expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key: "prepNoteNotifications:lastRecipientId" })).toBe(
      false,
    );
  });

  it("is false for a key that merely contains the store name as a substring", () => {
    expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key: "prepNoteNotificationsBackup" })).toBe(false);
    expect(isPrepNoteNotificationsLiveUpdateStorageEvent({ key: "old_prepNoteNotifications" })).toBe(false);
  });
});

describe("isPrepNotesPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of PREP_NOTES_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isPrepNotesPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isPrepNotesPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isPrepNotesPanelLiveUpdateStorageEvent({ key: "flowAnnotations" })).toBe(false);
    expect(isPrepNotesPanelLiveUpdateStorageEvent({ key: "prepNoteNotifications" })).toBe(false);
  });

  it("is false for a key that merely contains the store name as a substring", () => {
    expect(isPrepNotesPanelLiveUpdateStorageEvent({ key: "prepNotesBackup" })).toBe(false);
    expect(isPrepNotesPanelLiveUpdateStorageEvent({ key: "old_prepNotes" })).toBe(false);
  });
});
