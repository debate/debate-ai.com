import { describe, expect, it } from "vitest";
import {
  ARGUMENT_TREE_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  COUNSEL_PANEL_ASSESSMENTS_LIVE_UPDATE_STORAGE_KEYS,
  JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  VULNERABILITY_CHARTS_PANEL_LIVE_UPDATE_STORAGE_KEYS,
  WORD_COUNT_ROUNDS_LIVE_UPDATE_STORAGE_KEYS,
  isArgumentTreePanelLiveUpdateStorageEvent,
  isCounselPanelAssessmentsLiveUpdateStorageEvent,
  isJudgeParadigmPickerPanelLiveUpdateStorageEvent,
  isVulnerabilityChartsPanelLiveUpdateStorageEvent,
  isWordCountRoundsLiveUpdateStorageEvent,
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

describe("isVulnerabilityChartsPanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads directly", () => {
    for (const key of VULNERABILITY_CHARTS_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key: "counselPanelAssessments" })).toBe(false);
    expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key: "old_vulnerabilityReports" })).toBe(false);
    expect(isVulnerabilityChartsPanelLiveUpdateStorageEvent({ key: "vulnerabilityReportsBackup" })).toBe(false);
  });
});

describe("isCounselPanelAssessmentsLiveUpdateStorageEvent", () => {
  it("is true for every store key the hook reads", () => {
    for (const key of COUNSEL_PANEL_ASSESSMENTS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key: "vulnerabilityReports" })).toBe(false);
    expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key: "old_counselPanelAssessments" })).toBe(false);
    expect(isCounselPanelAssessmentsLiveUpdateStorageEvent({ key: "counselPanelAssessmentsBackup" })).toBe(false);
  });
});

describe("isArgumentTreePanelLiveUpdateStorageEvent", () => {
  it("is true for every store key the panel reads directly", () => {
    for (const key of ARGUMENT_TREE_PANEL_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isArgumentTreePanelLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isArgumentTreePanelLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isArgumentTreePanelLiveUpdateStorageEvent({ key: "outline-filter-presets" })).toBe(false);
    expect(isArgumentTreePanelLiveUpdateStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isArgumentTreePanelLiveUpdateStorageEvent({ key: "old_argumentTrees" })).toBe(false);
    expect(isArgumentTreePanelLiveUpdateStorageEvent({ key: "argumentTreeFiltersBackup" })).toBe(false);
  });
});

describe("isWordCountRoundsLiveUpdateStorageEvent", () => {
  it("is true for every store key the hook reads", () => {
    for (const key of WORD_COUNT_ROUNDS_LIVE_UPDATE_STORAGE_KEYS) {
      expect(isWordCountRoundsLiveUpdateStorageEvent({ key })).toBe(true);
    }
  });

  it("is true for a null key (localStorage.clear())", () => {
    expect(isWordCountRoundsLiveUpdateStorageEvent({ key: null })).toBe(true);
  });

  it("is false for an unrelated store's key", () => {
    expect(isWordCountRoundsLiveUpdateStorageEvent({ key: "word-limit-presets" })).toBe(false);
    expect(isWordCountRoundsLiveUpdateStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("is false for a key that merely contains a tracked store name as a substring", () => {
    expect(isWordCountRoundsLiveUpdateStorageEvent({ key: "old_wordCountRounds" })).toBe(false);
    expect(isWordCountRoundsLiveUpdateStorageEvent({ key: "wordCountRoundsBackup" })).toBe(false);
  });
});
