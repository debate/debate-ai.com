import { describe, expect, it } from "vitest";
import {
  applyHypotheticalAdjustments,
  buildCounselPanelTopArguments,
  buildHypotheticalScenarioComparison,
  buildVulnerabilityChartData,
  buildVulnerabilityChartDataFromReport,
  getArgumentVulnerabilityReport,
  scoreArgumentVulnerability,
  summarizeOutcomeBySide,
  summarizeOutcomeBySideFromReport,
} from "../src/flow/response-outcome";
import { getFlowRowSummaries } from "../src/flow/flow-transcript-summary";
import { getFlowSideKeys } from "../src/flow/argument-tree";
import type { Box } from "../src/types/flow";

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...(box as Box), ...overrides };
}

function summaryFor(columns: string[], contents: string[]) {
  const flow = { columns, children: [rowFromContents(contents)] };
  return getFlowRowSummaries(flow)[0];
}

describe("scoreArgumentVulnerability", () => {
  it("scores a dropped argument with no responses as base + unanswered", () => {
    const row = summaryFor(COLUMNS, ["Case advantage", "", "", ""]);
    expect(scoreArgumentVulnerability(row)).toBe(80);
  });

  it("adds weight for each direct opposing response while still unanswered", () => {
    const row = summaryFor(COLUMNS, ["Case advantage", "Turn", "", ""]);
    expect(row.isUnanswered).toBe(true);
    expect(scoreArgumentVulnerability(row)).toBe(90);
  });

  it("mixes opposing responses and same-side extensions once fully answered", () => {
    // 1AC (origin, A) -> 1NC (opposing) -> 2AC (same side) -> 2NC (opposing), fully flowed.
    const row = summaryFor(COLUMNS, ["Case advantage", "Turn", "Extend", "Frontline"]);
    expect(row.isUnanswered).toBe(false);
    expect(scoreArgumentVulnerability(row)).toBe(45);
  });

  it("clamps to 100 once opposing pressure exceeds the counted cap", () => {
    const columns = ["A1", "N1", "N2", "N3", "N4"];
    const row = summaryFor(columns, ["Case", "Resp1", "Resp2", "Resp3", ""]);
    expect(row.isUnanswered).toBe(true);
    expect(scoreArgumentVulnerability(row)).toBe(100);
  });

  it("clamps to 0 once same-side extensions exceed the counted cap", () => {
    const columns = ["A1", "A2", "A3", "A4"];
    const row = summaryFor(columns, ["Case", "Ext1", "Ext2", "Ext3"]);
    expect(row.isUnanswered).toBe(false);
    expect(scoreArgumentVulnerability(row)).toBe(0);
  });
});

describe("getArgumentVulnerabilityReport", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["On-case", "", "", ""], { isHeading: true }),
      rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]), // fully answered -> lower score
      rowFromContents(["Disad link", "", "", ""]), // dropped -> highest score
    ],
  };

  it("excludes headings, sorts by vulnerabilityScore descending", () => {
    const report = getArgumentVulnerabilityReport(flow);
    expect(report.map((r) => r.argument)).toEqual(["Disad link", "Case advantage"]);
    expect(report[0].vulnerabilityScore).toBeGreaterThan(report[1].vulnerabilityScore);
  });

  it("breaks ties by row order", () => {
    const tiedFlow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["First drop", "", "", ""]),
        rowFromContents(["Second drop", "", "", ""]),
      ],
    };
    const report = getArgumentVulnerabilityReport(tiedFlow);
    expect(report.map((r) => r.argument)).toEqual(["First drop", "Second drop"]);
  });
});

describe("summarizeOutcomeBySide", () => {
  it("rolls the report up per side and omits sides with no flowed arguments", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "", "", ""]), // A, dropped -> 80
        rowFromContents(["", "Neg-only point", "", ""]), // N, dropped -> 80
      ],
    };

    const summary = summarizeOutcomeBySide(flow);
    expect(summary).toEqual([
      { sideKey: "A", argumentCount: 1, unansweredCount: 1, averageVulnerability: 80 },
      { sideKey: "N", argumentCount: 1, unansweredCount: 1, averageVulnerability: 80 },
    ]);
  });

  it("averages multiple arguments on the same side", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]), // A origin, fully answered -> 45
        rowFromContents(["Second advantage", "", "", ""]), // A origin, dropped -> 80
      ],
    };

    const summary = summarizeOutcomeBySide(flow);
    expect(summary).toEqual([{ sideKey: "A", argumentCount: 2, unansweredCount: 1, averageVulnerability: 62.5 }]);
  });
});

describe("buildVulnerabilityChartData", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents([
        "A very long piece of case advantage text that should get truncated for the chart label display",
        "",
        "",
        "",
      ]),
      rowFromContents(["Disad link", "", "", ""]),
      rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]),
    ],
  };

  it("returns label/value points sorted by vulnerability, limited to the requested count", () => {
    const points = buildVulnerabilityChartData(flow, { limit: 2 });
    expect(points).toHaveLength(2);
    expect(points[0].value).toBeGreaterThanOrEqual(points[1].value);
    expect(points.every((p) => p.label.startsWith(p.sideKey === "A" ? "1AC:" : ""))).toBe(true);
  });

  it("truncates long argument text in the label", () => {
    const points = buildVulnerabilityChartData(flow, { limit: 1 });
    expect(points[0].label).toContain("…");
    expect(points[0].label.length).toBeLessThan(100);
  });

  it("defaults to a limit of 10", () => {
    const points = buildVulnerabilityChartData(flow);
    expect(points).toHaveLength(3);
  });
});

describe("summarizeOutcomeBySideFromReport", () => {
  it("matches summarizeOutcomeBySide's output given the same flow's derived report and side keys", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "", "", ""]),
        rowFromContents(["", "Neg-only point", "", ""]),
      ],
    };

    const report = getArgumentVulnerabilityReport(flow);
    const fromReport = summarizeOutcomeBySideFromReport(report, ["A", "N"]);
    expect(fromReport).toEqual(summarizeOutcomeBySide(flow));
  });

  it("omits sides absent from the given sideKeys list even if present in the report", () => {
    const report = getArgumentVulnerabilityReport({
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", "", "", ""])],
    });
    expect(summarizeOutcomeBySideFromReport(report, [])).toEqual([]);
  });
});

describe("buildVulnerabilityChartDataFromReport", () => {
  it("matches buildVulnerabilityChartData's output given the same flow's derived report", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Disad link", "", "", ""]),
        rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]),
      ],
    };

    const report = getArgumentVulnerabilityReport(flow);
    expect(buildVulnerabilityChartDataFromReport(report, { limit: 1 })).toEqual(
      buildVulnerabilityChartData(flow, { limit: 1 }),
    );
  });

  it("defaults to a limit of 10", () => {
    const report = getArgumentVulnerabilityReport({
      columns: COLUMNS,
      children: [rowFromContents(["Disad link", "", "", ""])],
    });
    expect(buildVulnerabilityChartDataFromReport(report)).toHaveLength(1);
  });
});

describe("applyHypotheticalAdjustments", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["Case advantage", "", "", ""]), // dropped -> 80, unanswered
      rowFromContents(["Disad link", "Turn", "Extend", "Frontline"]), // fully answered -> 45
    ],
  };
  const report = getArgumentVulnerabilityReport(flow);
  const dropped = report.find((row) => row.argument === "Case advantage")!;
  const answered = report.find((row) => row.argument === "Disad link")!;

  it("leaves rows unchanged when no adjustment names their rowIndex", () => {
    expect(applyHypotheticalAdjustments(report, [])).toEqual(report);
  });

  it("'extend' adds a same-side extension and lowers the score", () => {
    const [result] = applyHypotheticalAdjustments([dropped], [{ rowIndex: dropped.rowIndex, action: "extend" }]);
    expect(result.sameSideExtensions).toBe(dropped.sameSideExtensions + 1);
    expect(result.opposingResponses).toBe(dropped.opposingResponses);
    expect(result.isUnanswered).toBe(dropped.isUnanswered);
    expect(result.vulnerabilityScore).toBeLessThan(dropped.vulnerabilityScore);
  });

  it("'answer' adds an opposing response and resolves unanswered status", () => {
    const [result] = applyHypotheticalAdjustments([dropped], [{ rowIndex: dropped.rowIndex, action: "answer" }]);
    expect(result.opposingResponses).toBe(dropped.opposingResponses + 1);
    expect(result.isUnanswered).toBe(false);
    expect(result.vulnerabilityScore).toBeLessThan(dropped.vulnerabilityScore);
  });

  it("'concede' resets both response counts and marks the row unanswered again", () => {
    const [result] = applyHypotheticalAdjustments([answered], [{ rowIndex: answered.rowIndex, action: "concede" }]);
    expect(result.opposingResponses).toBe(0);
    expect(result.sameSideExtensions).toBe(0);
    expect(result.isUnanswered).toBe(true);
    expect(result.vulnerabilityScore).toBeGreaterThan(answered.vulnerabilityScore);
  });

  it("only adjusts the named row, leaving the rest of the report untouched", () => {
    const result = applyHypotheticalAdjustments(report, [{ rowIndex: dropped.rowIndex, action: "answer" }]);
    const untouched = result.find((row) => row.rowIndex === answered.rowIndex);
    expect(untouched).toEqual(answered);
  });

  it("caps the recomputed score the same way the original scoring does", () => {
    const columns = ["A1", "A2", "A3", "A4"];
    const alreadyCapped = getArgumentVulnerabilityReport({
      columns,
      children: [rowFromContents(["Case", "Ext1", "Ext2", "Ext3"])],
    })[0];
    expect(alreadyCapped.vulnerabilityScore).toBe(0);

    const [result] = applyHypotheticalAdjustments(
      [alreadyCapped],
      [{ rowIndex: alreadyCapped.rowIndex, action: "extend" }],
    );
    expect(result.sameSideExtensions).toBe(4);
    expect(result.vulnerabilityScore).toBe(0);
  });

  it("composes with buildVulnerabilityChartDataFromReport/summarizeOutcomeBySideFromReport", () => {
    const adjusted = applyHypotheticalAdjustments(report, [{ rowIndex: dropped.rowIndex, action: "answer" }]);

    const chart = buildVulnerabilityChartDataFromReport(adjusted);
    expect(chart.find((point) => point.rowIndex === dropped.rowIndex)?.value).toBe(
      adjusted.find((row) => row.rowIndex === dropped.rowIndex)?.vulnerabilityScore,
    );

    const sides = summarizeOutcomeBySideFromReport(adjusted, getFlowSideKeys(flow));
    const sideForDropped = sides.find((side) => side.sideKey === dropped.sideKey);
    expect(sideForDropped?.unansweredCount).toBe(0);
  });
});

describe("buildHypotheticalScenarioComparison", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["Case advantage", "", "", ""]), // dropped -> 80, unanswered
      rowFromContents(["Disad link", "Turn", "Extend", "Frontline"]), // fully answered -> 45
    ],
  };
  const report = getArgumentVulnerabilityReport(flow);
  const dropped = report.find((row) => row.argument === "Case advantage")!;
  const answered = report.find((row) => row.argument === "Disad link")!;
  const sideKeys = getFlowSideKeys(flow);

  it("throws when fewer than two scenarios are given", () => {
    expect(() =>
      buildHypotheticalScenarioComparison(report, sideKeys, [
        { name: "Only one", adjustments: [] },
      ]),
    ).toThrow(/at least two scenarios/);
    expect(() => buildHypotheticalScenarioComparison(report, sideKeys, [])).toThrow();
  });

  it("carries scenario names through in order", () => {
    const comparison = buildHypotheticalScenarioComparison(report, sideKeys, [
      { name: "Baseline", adjustments: [] },
      { name: "Concede the disad", adjustments: [{ rowIndex: answered.rowIndex, action: "concede" }] },
    ]);
    expect(comparison.scenarioNames).toEqual(["Baseline", "Concede the disad"]);
  });

  it("computes each scenario's own per-side rollup", () => {
    const comparison = buildHypotheticalScenarioComparison(report, sideKeys, [
      { name: "Baseline", adjustments: [] },
      { name: "Answer the drop", adjustments: [{ rowIndex: dropped.rowIndex, action: "answer" }] },
    ]);
    expect(comparison.sideSummaries[0]).toEqual(summarizeOutcomeBySideFromReport(report, sideKeys));
    const adjustedReport = applyHypotheticalAdjustments(report, [{ rowIndex: dropped.rowIndex, action: "answer" }]);
    expect(comparison.sideSummaries[1]).toEqual(summarizeOutcomeBySideFromReport(adjustedReport, sideKeys));
  });

  it("compares the same baseline top-N arguments across every scenario, scored per scenario", () => {
    const comparison = buildHypotheticalScenarioComparison(report, sideKeys, [
      { name: "Baseline", adjustments: [] },
      { name: "Answer the drop, concede the disad", adjustments: [
        { rowIndex: dropped.rowIndex, action: "answer" },
        { rowIndex: answered.rowIndex, action: "concede" },
      ] },
    ]);

    expect(comparison.argumentRows.map((row) => row.rowIndex)).toEqual(
      report.map((row) => row.rowIndex),
    );

    const droppedRow = comparison.argumentRows.find((row) => row.rowIndex === dropped.rowIndex)!;
    expect(droppedRow.scenarioScores[0]).toBe(dropped.vulnerabilityScore);
    expect(droppedRow.scenarioScores[1]).toBeLessThan(dropped.vulnerabilityScore);

    const answeredRow = comparison.argumentRows.find((row) => row.rowIndex === answered.rowIndex)!;
    expect(answeredRow.scenarioScores[0]).toBe(answered.vulnerabilityScore);
    expect(answeredRow.scenarioScores[1]).toBeGreaterThan(answered.vulnerabilityScore);
  });

  it("limits the compared argument set to the given limit, taken from the baseline ranking", () => {
    const comparison = buildHypotheticalScenarioComparison(
      report,
      sideKeys,
      [
        { name: "Baseline", adjustments: [] },
        { name: "Concede the disad", adjustments: [{ rowIndex: answered.rowIndex, action: "concede" }] },
      ],
      { limit: 1 },
    );
    expect(comparison.argumentRows).toHaveLength(1);
    expect(comparison.argumentRows[0].rowIndex).toBe(dropped.rowIndex);
  });
});

describe("buildCounselPanelTopArguments", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["Case advantage", "", "", ""]), // dropped -> 80, unanswered
      rowFromContents(["Disad link", "Turn", "Extend", "Frontline"]), // fully answered -> 45
    ],
  };
  const report = getArgumentVulnerabilityReport(flow);
  const dropped = report.find((row) => row.argument === "Case advantage")!;

  it("trims the top arguments to the counsel-panel request's fields, ranked by vulnerability", () => {
    expect(buildCounselPanelTopArguments(report, { limit: 1 })).toEqual([
      {
        rowIndex: dropped.rowIndex,
        argument: dropped.argument,
        originSpeech: dropped.originSpeech,
        isUnanswered: dropped.isUnanswered,
        vulnerabilityScore: dropped.vulnerabilityScore,
      },
    ]);
  });

  it("defaults to a limit of 10", () => {
    expect(buildCounselPanelTopArguments(report)).toHaveLength(report.length);
  });

  it("reflects a hypothetical-adjusted report instead of the original scores", () => {
    const adjusted = applyHypotheticalAdjustments(report, [{ rowIndex: dropped.rowIndex, action: "answer" }]);
    const [top] = buildCounselPanelTopArguments(adjusted, { limit: 1 });
    expect(top.rowIndex).toBe(dropped.rowIndex);
    expect(top.isUnanswered).toBe(false);
    expect(top.vulnerabilityScore).toBeLessThan(dropped.vulnerabilityScore);
  });
});
