import { describe, expect, it } from "vitest";
import {
  JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  isJudgeDecisionPanelLiveUpdateStorageEvent,
  isJudgeParadigmPickerPanelLiveUpdateStorageEvent,
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

describe("isJudgeDecisionPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads", () => {
    for (const key of JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key: "judgeProfiles" })).toBe(false);
    expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key: "judgeParadigmSelections" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key: "old_judgeDecisions" })).toBe(false);
    expect(isJudgeDecisionPanelLiveUpdateStorageEvent({ key: "judgeDecisionsBackup" })).toBe(false);
  });
});
