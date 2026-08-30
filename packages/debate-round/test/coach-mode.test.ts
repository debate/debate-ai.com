import { describe, expect, it } from "vitest";
import {
  buildCoachingSession,
  buildCoachingSummaryText,
  buildCollapsePrompts,
  buildExtensionPrompts,
  buildRefutationPrompts,
  buildWeighingGuidance,
} from "../src/flow/coach-mode";
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

const EMPTY_FLOW = { columns: COLUMNS, children: [] };

// Row 0: "Case advantage" (A side, origin 1AC) — dropped after 1NC, unanswered since 1NC (N side).
// Row 1: "Disad link" (N side, origin 1NC) — dropped after 2AC, unanswered since 2AC (A side).
// Row 2: "Topicality" (N side, origin 1NC) — fully answered through 2NC.
const MIXED_FLOW = {
  columns: COLUMNS,
  children: [
    rowFromContents(["Case advantage", "Turn", "", ""]),
    rowFromContents(["", "Disad link", "Case turn", ""]),
    rowFromContents(["", "Topicality", "We meet", "Counter-interp"]),
  ],
};

describe("buildExtensionPrompts", () => {
  it("only prompts extending arguments whose last word is on the caller's own side", () => {
    // Row 1 last touched in 2AC (side A) stands unanswered — side A should extend it.
    const prompts = buildExtensionPrompts(MIXED_FLOW, "A");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ kind: "extension", rowIndex: 1 });
    expect(prompts[0].prompt).toContain("Disad link");
    expect(prompts[0].prompt).toContain("Extend");
  });

  it("returns an empty array for an empty flow", () => {
    expect(buildExtensionPrompts(EMPTY_FLOW, "A")).toEqual([]);
  });

  it("truncates a very long argument in the extension prompt", () => {
    const longArgument = "x".repeat(200);
    const flow = { columns: COLUMNS, children: [rowFromContents([longArgument, "", "", ""])] };
    const [prompt] = buildExtensionPrompts(flow, "A");
    expect(prompt.prompt).toContain("…");
    expect(prompt.prompt.length).toBeLessThan(longArgument.length + 100);
  });
});

describe("buildRefutationPrompts", () => {
  it("only prompts answering arguments whose last word is on the opposing side", () => {
    // Row 0 last touched in 1NC (side N) stands unanswered — side A must answer it.
    const prompts = buildRefutationPrompts(MIXED_FLOW, "A");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ kind: "refutation", rowIndex: 0 });
    expect(prompts[0].prompt).toContain("Case advantage");
    expect(prompts[0].prompt).toContain("Answer");
  });

  it("returns an empty array once every argument is answered", () => {
    const flow = {
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"])],
    };
    expect(buildRefutationPrompts(flow, "N")).toEqual([]);
  });
});

describe("buildCollapsePrompts", () => {
  it("delegates to drill-generator's collapse ranking, never recommending the caller's own side", () => {
    const prompts = buildCollapsePrompts(MIXED_FLOW, "N");
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((prompt) => prompt.kind === "collapse")).toBe(true);
    expect(prompts.every((prompt) => prompt.prompt.includes("Case advantage"))).toBe(true);
    expect(prompts.some((prompt) => prompt.prompt.includes("Disad link"))).toBe(false);
    expect(prompts.some((prompt) => prompt.prompt.includes("Topicality"))).toBe(false);
  });

  it("respects a custom limit", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case 1", "", "", ""]),
        rowFromContents(["Case 2", "", "", ""]),
        rowFromContents(["Case 3", "", "", ""]),
      ],
    };
    expect(buildCollapsePrompts(flow, "N", { limit: 2 })).toHaveLength(2);
  });

  it("returns an empty array for an empty flow", () => {
    expect(buildCollapsePrompts(EMPTY_FLOW, "A")).toEqual([]);
  });
});

describe("buildWeighingGuidance", () => {
  it("returns null when the caller's side hasn't flowed anything", () => {
    expect(buildWeighingGuidance(MIXED_FLOW, "P")).toBeNull();
  });

  it("returns null when only one side is represented in the flow", () => {
    const flow = { columns: COLUMNS, children: [rowFromContents(["Case advantage", "", "", ""])] };
    expect(buildWeighingGuidance(flow, "A")).toBeNull();
  });

  // Side A's argument is fully defended (answered through the last column,
  // with a same-side extension shoring it up) → low vulnerability, no
  // unanswered rows. Side N's argument is dropped after 1NC → unanswered,
  // high vulnerability. So side A is ahead of side N.
  const LOPSIDED_FLOW = {
    columns: COLUMNS,
    children: [
      rowFromContents(["Case advantage", "", "Extend", "Frontline"]), // A, fully defended
      rowFromContents(["", "Disad link", "", ""]), // N, dropped/unanswered
    ],
  };

  it("frames the side ahead on both unanswered count and vulnerability as favored", () => {
    const guidance = buildWeighingGuidance(LOPSIDED_FLOW, "A");
    expect(guidance?.kind).toBe("weighing");
    expect(guidance?.rowIndex).toBeNull();
    expect(guidance?.prompt).toContain("ahead of N");
    expect(guidance?.prompt).toContain("uncontested offense");
  });

  it("warns the side behind on both signals to shore up its case", () => {
    const guidance = buildWeighingGuidance(LOPSIDED_FLOW, "N");
    expect(guidance?.prompt).toContain("A currently looks stronger");
    expect(guidance?.prompt).toContain("shore up your case");
  });
});

describe("buildCoachingSession", () => {
  it("combines refutation, extension, collapse, and weighing prompts in priority order", () => {
    const prompts = buildCoachingSession(MIXED_FLOW, "A");
    expect(prompts.map((prompt) => prompt.kind)).toEqual([
      "refutation",
      "extension",
      "collapse",
      "collapse",
      "weighing",
    ]);
  });

  it("omits weighing guidance when there's nothing to weigh, but keeps other prompts", () => {
    const flow = { columns: COLUMNS, children: [rowFromContents(["Case advantage", "", "", ""])] };
    const prompts = buildCoachingSession(flow, "A");
    expect(prompts.some((prompt) => prompt.kind === "weighing")).toBe(false);
  });

  it("returns an empty array for an empty flow", () => {
    expect(buildCoachingSession(EMPTY_FLOW, "A")).toEqual([]);
  });
});

describe("buildCoachingSummaryText", () => {
  it("reports no prompts available for an empty session", () => {
    expect(buildCoachingSummaryText([])).toBe(
      "No coaching prompts available yet — nothing has been flowed.",
    );
  });

  it("renders one labeled line per prompt", () => {
    const text = buildCoachingSummaryText(buildCoachingSession(MIXED_FLOW, "A"));
    const lines = text.split("\n");
    expect(lines).toHaveLength(5);
    expect(text).toContain("[Refutation]");
    expect(text).toContain("[Extension]");
    expect(text).toContain("[Collapse]");
    expect(text).toContain("[Weighing]");
  });
});
