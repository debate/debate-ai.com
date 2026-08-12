import { describe, expect, it } from "vitest";
import {
  buildFlowSummaryText,
  getFlowRowSummaries,
  getUnansweredFlowRows,
  suggestCrossExamQuestions,
  suggestExtensionIdeas,
  summarizeFlowRow,
  type FlowRowSummary,
} from "../src/flow/flow-transcript-summary";
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

describe("summarizeFlowRow", () => {
  it("returns null for a row with no flowed content in any column", () => {
    const row = rowFromContents(["", "", "", ""]);
    expect(summarizeFlowRow(row, COLUMNS, 0)).toBeNull();
  });

  it("summarizes an argument that was answered every step", () => {
    const row = rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]);
    const summary = summarizeFlowRow(row, COLUMNS, 0);

    expect(summary).toMatchObject({
      rowIndex: 0,
      argument: "Case advantage",
      originSpeech: "1AC",
      lastSpeech: "2NC",
      isUnanswered: false,
    });
    expect(summary?.entries).toEqual([
      { speech: "1AC", content: "Case advantage" },
      { speech: "1NC", content: "Turn" },
      { speech: "2AC", content: "Extend" },
      { speech: "2NC", content: "Frontline" },
    ]);
  });

  it("flags an argument dropped after its last flowed entry", () => {
    const row = rowFromContents(["Case advantage", "Turn", "", ""]);
    const summary = summarizeFlowRow(row, COLUMNS, 0);

    expect(summary).toMatchObject({
      argument: "Case advantage",
      originSpeech: "1AC",
      lastSpeech: "1NC",
      isUnanswered: true,
    });
  });

  it("does not flag an argument last flowed in the final column as unanswered", () => {
    const row = rowFromContents(["", "", "", "Final frontline"]);
    const summary = summarizeFlowRow(row, COLUMNS, 0);

    expect(summary).toMatchObject({
      originSpeech: "2NC",
      lastSpeech: "2NC",
      isUnanswered: false,
    });
  });

  it("skips over gaps: content resumes after a blank column", () => {
    const row = rowFromContents(["Case advantage", "", "Extend", ""]);
    const summary = summarizeFlowRow(row, COLUMNS, 0);

    expect(summary?.entries).toEqual([
      { speech: "1AC", content: "Case advantage" },
      { speech: "2AC", content: "Extend" },
    ]);
    expect(summary?.isUnanswered).toBe(true);
    expect(summary?.lastSpeech).toBe("2AC");
  });

  it("carries isHeading through from the row's root box", () => {
    const row = rowFromContents(["Section header", "", "", ""], { isHeading: true });
    expect(summarizeFlowRow(row, COLUMNS, 0)?.isHeading).toBe(true);
  });
});

describe("getFlowRowSummaries / getUnansweredFlowRows", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]),
      rowFromContents(["Disad link", "", "", ""]),
      rowFromContents(["", "", "", ""]),
      rowFromContents(["Section header", "", "", ""], { isHeading: true }),
    ],
  };

  it("summarizes only rows with flowed content", () => {
    const summaries = getFlowRowSummaries(flow);
    expect(summaries).toHaveLength(3);
    expect(summaries.map((row) => row.argument)).toEqual([
      "Case advantage",
      "Disad link",
      "Section header",
    ]);
  });

  it("excludes headings and answered rows from unanswered rows", () => {
    const unanswered = getUnansweredFlowRows(flow);
    expect(unanswered.map((row) => row.argument)).toEqual(["Disad link"]);
  });
});

describe("buildFlowSummaryText", () => {
  it("reports no arguments flowed yet for an empty flow", () => {
    expect(buildFlowSummaryText({ columns: COLUMNS, children: [] })).toBe(
      "No arguments have been flowed yet.",
    );
  });

  it("lists each argument and flags unanswered ones", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "Turn", "", ""]),
        rowFromContents(["Disad link", "", "", "Weighing"]),
      ],
    };

    const text = buildFlowSummaryText(flow);
    expect(text).toBe(
      "1AC: Case advantage (unanswered since 1NC)\n1AC: Disad link",
    );
  });

  it("truncates very long argument content for display", () => {
    const longContent = "x".repeat(300);
    const flow = { columns: COLUMNS, children: [rowFromContents([longContent, "", "", ""])] };

    const text = buildFlowSummaryText(flow);
    expect(text.length).toBeLessThan(longContent.length);
    expect(text).toContain("…");
  });
});

describe("suggestCrossExamQuestions / suggestExtensionIdeas", () => {
  const rows: FlowRowSummary[] = [
    {
      rowIndex: 0,
      isHeading: false,
      argument: "Case advantage",
      originSpeech: "1AC",
      entries: [{ speech: "1AC", content: "Case advantage" }],
      lastSpeech: "1AC",
      isUnanswered: true,
    },
    {
      rowIndex: 1,
      isHeading: false,
      argument: "Answered turn",
      originSpeech: "1NC",
      entries: [{ speech: "1NC", content: "Answered turn" }],
      lastSpeech: "1NC",
      isUnanswered: false,
    },
  ];

  it("only generates questions/ideas for unanswered rows", () => {
    expect(suggestCrossExamQuestions(rows)).toHaveLength(1);
    expect(suggestExtensionIdeas(rows)).toHaveLength(1);
  });

  it("references the argument and drop point in the generated question", () => {
    const [question] = suggestCrossExamQuestions(rows);
    expect(question).toContain("Case advantage");
    expect(question).toContain("1AC");
  });

  it("frames the extension idea around dropping/conceding", () => {
    const [idea] = suggestExtensionIdeas(rows);
    expect(idea).toContain("Case advantage");
    expect(idea).toContain("dropped/conceded");
  });
});
