import { describe, expect, it } from "vitest";
import {
  JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  isJudgeParadigmPickerPanelLiveUpdateStorageEvent,
  OPPONENT_PERSONA_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  isOpponentPersonaPickerPanelLiveUpdateStorageEvent,
} from "../src/state/live-update";

describe("isJudgeParadigmPickerPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key: "judgeProfiles" })).toBe(false);
    expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key: "old_judgeParadigmSelections" })).toBe(false);
    expect(isJudgeParadigmPickerPanelLiveUpdateStorageEvent({ key: "judgeParadigmSelectionsBackup" })).toBe(false);
  });
});

describe("isOpponentPersonaPickerPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of OPPONENT_PERSONA_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key: "judgeParadigmSelections" })).toBe(false);
    expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key: "customOpponentPersonaLibrary" })).toBe(false);
  });

  it("is false for a key that merely contains the tracked store name as a substring", () => {
    expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key: "old_opponentPersonaSelections" })).toBe(false);
    expect(isOpponentPersonaPickerPanelLiveUpdateStorageEvent({ key: "opponentPersonaSelectionsBackup" })).toBe(false);
  });
});
