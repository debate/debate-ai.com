import { describe, expect, it } from "vitest";
import {
  buildVulnerabilityChartData,
  getArgumentVulnerabilityReport,
  scoreArgumentVulnerability,
  summarizeOutcomeBySide,
} from "../src/flow/response-outcome";
import { getFlowRowSummaries } from "../src/flow/flow-transcript-summary";
import type { Box } from "debate-core/src/types/flow";

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
