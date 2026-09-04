import { describe, expect, it } from "vitest";
import {
  buildResponseOutcomeReportText,
  responseOutcomeReportFilename,
  type ResponseOutcomeReportInput,
} from "../src/flow/response-outcome-report";
import type { CounselPanelAssessmentRecord } from "../src/state/counselPanelAssessments";

const BASE_INPUT: ResponseOutcomeReportInput = {
  roundId: "round-1",
  sideSummaries: [
    { sideKey: "Aff", argumentCount: 3, unansweredCount: 1, averageVulnerability: 42.5 },
    { sideKey: "Neg", argumentCount: 2, unansweredCount: 0, averageVulnerability: 10 },
  ],
  chartPoints: [
    { rowIndex: 0, label: "1AC: Warming is real", sideKey: "Aff", value: 80 },
    { rowIndex: 1, label: "1NC: No impact", sideKey: "Neg", value: 30 },
  ],
};

const ASSESSMENT: CounselPanelAssessmentRecord = {
  id: "assessment-1",
  roundId: "round-1",
  generatedAt: 1700000000000,
  result: {
    argumentAssessments: [
      {
        rowIndex: 0,
        counselRole: "Weighing Counsel",
        likelyResponsePath: "Turn the impact",
        clashEstimate: "High clash expected",
      },
    ],
    overallClashSummary: "The affirmative's warming claim is the round's central clash point.",
  },
};

describe("buildResponseOutcomeReportText", () => {
  it("renders a header with the round id", () => {
    const text = buildResponseOutcomeReportText(BASE_INPUT);
    expect(text).toContain("AI Response-Outcome Chart — Round round-1");
  });

  it("renders each side's exposure summary", () => {
    const text = buildResponseOutcomeReportText(BASE_INPUT);
    expect(text).toContain("Aff: 42.5 avg vulnerability, 3 arguments, 1 unanswered");
    expect(text).toContain("Neg: 10 avg vulnerability, 2 arguments, 0 unanswered");
  });

  it("renders each chart point's value and label, in the given order", () => {
    const text = buildResponseOutcomeReportText(BASE_INPUT);
    const first = text.indexOf("80 — 1AC: Warming is real");
    const second = text.indexOf("30 — 1NC: No impact");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it("uses singular 'argument' for a side with exactly one", () => {
    const text = buildResponseOutcomeReportText({
      ...BASE_INPUT,
      sideSummaries: [{ sideKey: "Aff", argumentCount: 1, unansweredCount: 1, averageVulnerability: 50 }],
    });
    expect(text).toContain("Aff: 50 avg vulnerability, 1 argument, 1 unanswered");
  });

  it("renders placeholder lines when there are no flowed arguments yet", () => {
    const text = buildResponseOutcomeReportText({ roundId: "round-2", sideSummaries: [], chartPoints: [] });
    expect(text).toContain("No flowed arguments to summarize yet.");
    expect(text).toContain("No flowed arguments to chart yet.");
  });

  it("omits the AI counsel panel section when no assessment has been requested", () => {
    const text = buildResponseOutcomeReportText(BASE_INPUT);
    expect(text).not.toContain("AI counsel panel:");
  });

  it("renders the latest assessment's clash summary and per-argument detail when present", () => {
    const text = buildResponseOutcomeReportText({ ...BASE_INPUT, latestAssessment: ASSESSMENT });
    expect(text).toContain("AI counsel panel:");
    expect(text).toContain("The affirmative's warming claim is the round's central clash point.");
    expect(text).toContain("- 1AC: Warming is real (Weighing Counsel)");
    expect(text).toContain("Likely response: Turn the impact");
    expect(text).toContain("Clash estimate: High clash expected");
  });

  it("falls back to a row-index label when the assessed row has no matching chart point", () => {
    const text = buildResponseOutcomeReportText({
      ...BASE_INPUT,
      chartPoints: [],
      latestAssessment: ASSESSMENT,
    });
    expect(text).toContain("- Row 0 (Weighing Counsel)");
  });
});

describe("responseOutcomeReportFilename", () => {
  it("builds a lowercase, hyphenated filename from a simple round id", () => {
    expect(responseOutcomeReportFilename("round-1")).toBe("response-outcome-round-1-report.txt");
  });

  it("collapses non-alphanumeric characters and mixed case into single hyphens", () => {
    expect(responseOutcomeReportFilename("My Round #3!")).toBe("response-outcome-my-round-3-report.txt");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(responseOutcomeReportFilename("  --round--  ")).toBe("response-outcome-round-report.txt");
  });

  it("falls back to a generic name when the round id has no alphanumeric characters", () => {
    expect(responseOutcomeReportFilename("###")).toBe("response-outcome-round-report.txt");
  });
});
