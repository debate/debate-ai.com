import { describe, expect, it } from "vitest";
import {
  buildCollapseDrills,
  buildCrossExamDrills,
  buildDrillSet,
  buildDrillSummaryText,
  buildFrontlineDrills,
  buildOverviewDrill,
} from "../src/flow/drill-generator";
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

const EMPTY_FLOW = { columns: COLUMNS, children: [] };

// Row 0: "Case advantage" (A side, origin 1AC) — dropped after 1NC, unanswered.
// Row 1: "Disad link" (N side, origin 1NC) — fully answered through 2NC.
const MIXED_FLOW = {
  columns: COLUMNS,
  children: [
    rowFromContents(["Case advantage", "Turn", "", ""]),
    rowFromContents(["", "Disad link", "Extend", "Frontline"]),
  ],
};

describe("buildOverviewDrill", () => {
  it("returns null when nothing has been flowed yet", () => {
    expect(buildOverviewDrill(EMPTY_FLOW)).toBeNull();
  });

  it("weighs every side represented in the flow", () => {
    const drill = buildOverviewDrill(MIXED_FLOW);
    expect(drill?.kind).toBe("overview");
    expect(drill?.rowIndex).toBeNull();
    expect(drill?.prompt).toContain("A (");
    expect(drill?.prompt).toContain("N (");
    expect(drill?.prompt).toContain("vs.");
  });
});

describe("buildFrontlineDrills", () => {
  it("only drills unanswered arguments on the opposing side", () => {
    const drills = buildFrontlineDrills(MIXED_FLOW, "A");
    expect(drills).toHaveLength(0);
  });

  it("generates a frontline prompt for the opponent's unanswered argument", () => {
    // Row 0 originates on side A (1AC) and is unanswered, so side "N" needs a frontline for it.
    const drills = buildFrontlineDrills(MIXED_FLOW, "N");
    expect(drills).toHaveLength(1);
    expect(drills[0].kind).toBe("frontline");
    expect(drills[0].rowIndex).toBe(0);
    expect(drills[0].prompt).toContain("Case advantage");
    expect(drills[0].prompt).toContain("1AC");
  });

  it("returns an empty array for an empty flow", () => {
    expect(buildFrontlineDrills(EMPTY_FLOW, "A")).toEqual([]);
  });
});

describe("buildCrossExamDrills", () => {
  it("drills every unanswered argument regardless of side", () => {
    const drills = buildCrossExamDrills(MIXED_FLOW);
    expect(drills).toHaveLength(1);
    expect(drills[0]).toMatchObject({ kind: "cross_ex", rowIndex: 0 });
    expect(drills[0].prompt).toContain("Case advantage");
  });

  it("returns an empty array once every argument is answered", () => {
    const flow = {
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"])],
    };
    expect(buildCrossExamDrills(flow)).toEqual([]);
  });
});

describe("buildCollapseDrills", () => {
  it("recommends the opposing side's most vulnerable arguments", () => {
    const drills = buildCollapseDrills(MIXED_FLOW, "N");
    expect(drills).toHaveLength(1);
    expect(drills[0]).toMatchObject({ kind: "collapse", rowIndex: 0 });
    expect(drills[0].prompt).toContain("Case advantage");
    expect(drills[0].prompt).toContain("vulnerability");
  });

  it("never recommends collapsing onto your own side's arguments", () => {
    const drills = buildCollapseDrills(MIXED_FLOW, "N");
    expect(drills.every((drill) => !drill.prompt.includes("Disad link"))).toBe(true);
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
    expect(buildCollapseDrills(flow, "N", { limit: 2 })).toHaveLength(2);
  });

  it("returns an empty array for an empty flow", () => {
    expect(buildCollapseDrills(EMPTY_FLOW, "A")).toEqual([]);
  });

  it("notes same-side extension count for an already-answered opposing argument", () => {
    // Row originates on side A (1AC) and is fully answered through 2NC (one same-side extension at 2AC).
    const flow = {
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"])],
    };
    const [drill] = buildCollapseDrills(flow, "N");
    expect(drill.prompt).toContain("only 1 same-side extension(s) since");
  });

  it("truncates a very long argument in the collapse prompt", () => {
    const longArgument = "x".repeat(200);
    const flow = { columns: COLUMNS, children: [rowFromContents([longArgument, "", "", ""])] };
    const [drill] = buildCollapseDrills(flow, "N");
    expect(drill.prompt).toContain("…");
    expect(drill.prompt.length).toBeLessThan(longArgument.length + 100);
  });
});

describe("buildDrillSet", () => {
  it("combines overview, frontline, cross-ex, and collapse drills in order", () => {
    const drills = buildDrillSet(MIXED_FLOW, "N");
    expect(drills.map((drill) => drill.kind)).toEqual([
      "overview",
      "frontline",
      "cross_ex",
      "collapse",
    ]);
  });

  it("omits the overview drill for an empty flow and returns no drills", () => {
    expect(buildDrillSet(EMPTY_FLOW, "A")).toEqual([]);
  });
});

describe("buildDrillSummaryText", () => {
  it("reports no drills available for an empty set", () => {
    expect(buildDrillSummaryText([])).toBe("No drills available yet — nothing has been flowed.");
  });

  it("renders one labeled line per drill", () => {
    const text = buildDrillSummaryText(buildDrillSet(MIXED_FLOW, "N"));
    expect(text.split("\n")).toHaveLength(4);
    expect(text).toContain("[Overview]");
    expect(text).toContain("[Frontline]");
    expect(text).toContain("[Cross-Ex]");
    expect(text).toContain("[Collapse]");
  });
});
