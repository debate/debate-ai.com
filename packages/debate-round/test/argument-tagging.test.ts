import { describe, expect, it } from "vitest";
import {
  formatArgumentTags,
  getRowArgumentTags,
  getSectionRowIndexes,
  getSectionRowPreviews,
  inferArgumentType,
  listAuthorIdsInFlow,
  setRowArgumentTags,
  setRowsArgumentTags,
} from "../src/flow/argument-tagging";
import { buildRowData, rowDataToBoxes } from "../src/flow/dataTransform";
import { buildArgumentTree, filterArgumentTree } from "../src/flow/argument-tree";
import type { Box } from "debate-core/src/types/flow";

const COLUMNS = ["1AC", "1NC", "2AC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
  }
  return { ...(box as Box), ...overrides };
}

function flowWith(children: Box[]) {
  return { children, columns: COLUMNS };
}

describe("getRowArgumentTags", () => {
  it("reads the tags set on the row's root box", () => {
    const flow = flowWith([
      rowFromContents(["Warming advantage", "", ""], {
        argumentType: "impact",
        authorId: "alex",
        evidenceStatus: "cited",
      }),
    ]);
    expect(getRowArgumentTags(flow, 0)).toEqual({
      argumentType: "impact",
      authorId: "alex",
      evidenceStatus: "cited",
    });
  });

  it("returns an empty object for an untagged row and for an unknown row index", () => {
    const flow = flowWith([rowFromContents(["Uniqueness", "", ""])]);
    expect(getRowArgumentTags(flow, 0)).toEqual({
      argumentType: undefined,
      authorId: undefined,
      evidenceStatus: undefined,
    });
    expect(getRowArgumentTags(flow, 7)).toEqual({});
  });
});

describe("setRowArgumentTags", () => {
  it("sets all three tags on the addressed row without touching its siblings", () => {
    const flow = flowWith([
      rowFromContents(["Link", "", ""]),
      rowFromContents(["Impact", "", ""]),
    ]);
    const updated = setRowArgumentTags(flow, 1, {
      argumentType: "impact",
      authorId: "sam",
      evidenceStatus: "contested",
    });

    expect(getRowArgumentTags(updated, 1)).toEqual({
      argumentType: "impact",
      authorId: "sam",
      evidenceStatus: "contested",
    });
    expect(updated.children[0]).toBe(flow.children[0]);
    expect(flow.children[1].argumentType).toBeUndefined();
  });

  it("clears a tag left undefined and an author id that is only whitespace", () => {
    const flow = flowWith([
      rowFromContents(["Link", "", ""], {
        argumentType: "link",
        authorId: "alex",
        evidenceStatus: "cited",
      }),
    ]);
    const updated = setRowArgumentTags(flow, 0, {
      argumentType: undefined,
      authorId: "   ",
      evidenceStatus: "unverified",
    });

    expect("argumentType" in updated.children[0]).toBe(false);
    expect("authorId" in updated.children[0]).toBe(false);
    expect(updated.children[0].evidenceStatus).toBe("unverified");
  });

  it("returns the flow unchanged for an out-of-range row index", () => {
    const flow = flowWith([rowFromContents(["Link", "", ""])]);
    expect(setRowArgumentTags(flow, 4, { argumentType: "turn" })).toBe(flow);
  });

  it("produces tags the argument tree can filter on", () => {
    const flow = flowWith([
      rowFromContents(["Link", "", ""]),
      rowFromContents(["Turn", "", ""]),
    ]);
    const updated = setRowArgumentTags(flow, 1, { argumentType: "turn" });
    const filtered = filterArgumentTree(buildArgumentTree(updated), { argumentType: "turn" });

    expect(filtered.map((node) => node.content)).toEqual(["Turn"]);
  });
});

describe("setRowsArgumentTags", () => {
  it("applies the same tags to every listed row and leaves the rest untouched", () => {
    const flow = flowWith([
      rowFromContents(["Link", "", ""]),
      rowFromContents(["Impact", "", ""]),
      rowFromContents(["Uniqueness", "", ""]),
    ]);
    const updated = setRowsArgumentTags(flow, [0, 2], {
      argumentType: "extension",
      authorId: "sam",
    });

    expect(getRowArgumentTags(updated, 0)).toEqual({
      argumentType: "extension",
      authorId: "sam",
      evidenceStatus: undefined,
    });
    expect(getRowArgumentTags(updated, 2)).toEqual({
      argumentType: "extension",
      authorId: "sam",
      evidenceStatus: undefined,
    });
    expect(updated.children[1]).toBe(flow.children[1]);
  });

  it("ignores duplicate and out-of-range indexes", () => {
    const flow = flowWith([rowFromContents(["Link", "", ""])]);
    const updated = setRowsArgumentTags(flow, [0, 0, 9], { argumentType: "link" });

    expect(getRowArgumentTags(updated, 0).argumentType).toBe("link");
    expect(updated.children).toHaveLength(1);
  });

  it("returns the flow unchanged when no index resolves to a real row", () => {
    const flow = flowWith([rowFromContents(["Link", "", ""])]);
    expect(setRowsArgumentTags(flow, [4, 9], { argumentType: "turn" })).toBe(flow);
  });
});

describe("getSectionRowIndexes", () => {
  it("collects every content row under the nearest preceding heading", () => {
    const flow = flowWith([
      rowFromContents(["Advantage: Warming", "", ""], { isHeading: true }),
      rowFromContents(["Link", "", ""]),
      rowFromContents(["Impact", "", ""]),
      rowFromContents(["Advantage: Econ", "", ""], { isHeading: true }),
      rowFromContents(["Uniqueness", "", ""]),
    ]);

    expect(getSectionRowIndexes(flow, 1)).toEqual([1, 2]);
    expect(getSectionRowIndexes(flow, 2)).toEqual([1, 2]);
    expect(getSectionRowIndexes(flow, 4)).toEqual([4]);
  });

  it("treats a heading row's own section as the rows that follow it", () => {
    const flow = flowWith([
      rowFromContents(["Advantage: Warming", "", ""], { isHeading: true }),
      rowFromContents(["Link", "", ""]),
      rowFromContents(["Advantage: Econ", "", ""], { isHeading: true }),
    ]);

    expect(getSectionRowIndexes(flow, 0)).toEqual([1]);
    expect(getSectionRowIndexes(flow, 2)).toEqual([]);
  });

  it("treats rows before any heading as their own section", () => {
    const flow = flowWith([
      rowFromContents(["Untagged intro", "", ""]),
      rowFromContents(["Advantage: Warming", "", ""], { isHeading: true }),
      rowFromContents(["Link", "", ""]),
    ]);

    expect(getSectionRowIndexes(flow, 0)).toEqual([0]);
  });

  it("returns an empty array for an out-of-range row index", () => {
    const flow = flowWith([rowFromContents(["Link", "", ""])]);
    expect(getSectionRowIndexes(flow, -1)).toEqual([]);
    expect(getSectionRowIndexes(flow, 5)).toEqual([]);
  });
});

describe("getSectionRowPreviews", () => {
  it("returns every other row in the section with its content and tags", () => {
    const flow = flowWith([
      rowFromContents(["Advantage: Warming", "", ""], { isHeading: true }),
      rowFromContents(["Link", "", ""], { argumentType: "link" }),
      rowFromContents(["Impact", "", ""], { argumentType: "impact", authorId: "sam" }),
    ]);

    expect(getSectionRowPreviews(flow, 1)).toEqual([
      { rowIndex: 2, label: "Impact", tags: { argumentType: "impact", authorId: "sam", evidenceStatus: undefined } },
    ]);
  });

  it("truncates a long row's content and returns [] with no section neighbours", () => {
    const longContent = "A".repeat(60);
    const flow = flowWith([rowFromContents([longContent, "", ""])]);

    expect(getSectionRowPreviews(flow, 0)).toEqual([]);

    const withNeighbour = flowWith([
      rowFromContents([longContent, "", ""]),
      rowFromContents(["Impact", "", ""]),
    ]);
    const previews = getSectionRowPreviews(withNeighbour, 1);
    expect(previews).toHaveLength(1);
    expect(previews[0].label).toBe(`${longContent.slice(0, 40)}…`);
  });
});

describe("dataTransform round trip", () => {
  it("carries a row's tags through buildRowData -> rowDataToBoxes", () => {
    const children = [
      rowFromContents(["Link", "", ""], {
        argumentType: "link",
        authorId: "alex",
        evidenceStatus: "cited",
      }),
    ];
    const rows = buildRowData(children, COLUMNS);
    rows[0].col_1 = "They say no link";

    const roundTripped = rowDataToBoxes(rows, COLUMNS);
    expect(roundTripped[0].argumentType).toBe("link");
    expect(roundTripped[0].authorId).toBe("alex");
    expect(roundTripped[0].evidenceStatus).toBe("cited");
    expect(roundTripped[0].children[0].content).toBe("They say no link");
  });

  it("leaves an untagged row's tag fields unset", () => {
    const rows = buildRowData([rowFromContents(["Link", "", ""])], COLUMNS);
    const roundTripped = rowDataToBoxes(rows, COLUMNS);

    expect("argumentType" in roundTripped[0]).toBe(false);
    expect("authorId" in roundTripped[0]).toBe(false);
    expect("evidenceStatus" in roundTripped[0]).toBe(false);
  });
});

describe("formatArgumentTags", () => {
  it("renders type, evidence status, then contributor", () => {
    expect(
      formatArgumentTags({ argumentType: "link", authorId: "alex", evidenceStatus: "cited" }),
    ).toBe("link · cited · alex");
  });

  it("skips missing parts and returns an empty string when nothing is tagged", () => {
    expect(formatArgumentTags({ argumentType: "turn" })).toBe("turn");
    expect(formatArgumentTags({ authorId: "  " })).toBe("");
    expect(formatArgumentTags({})).toBe("");
  });
});

describe("inferArgumentType", () => {
  it("detects a turn before the more generic impact/link rules", () => {
    expect(inferArgumentType("This turns their warming impact")).toBe("turn");
  });

  it("detects an extension", () => {
    expect(inferArgumentType("Extend the uniqueness debate, it still stands")).toBe("extension");
  });

  it("detects an answer", () => {
    expect(inferArgumentType("They say no link, but that's wrong")).toBe("answer");
  });

  it("detects an impact", () => {
    expect(inferArgumentType("This outweighs on magnitude and timeframe")).toBe("impact");
  });

  it("detects a link", () => {
    expect(inferArgumentType("The internal link to the economy is clear")).toBe("link");
  });

  it("detects a contention/advantage heading", () => {
    expect(inferArgumentType("Advantage 1: Warming")).toBe("contention");
  });

  it("is case-insensitive", () => {
    expect(inferArgumentType("THIS TURNS THE CASE")).toBe("turn");
  });

  it("returns undefined for content matching no rule, and for empty/whitespace content", () => {
    expect(inferArgumentType("Just a neutral sentence with nothing special")).toBeUndefined();
    expect(inferArgumentType("")).toBeUndefined();
    expect(inferArgumentType("   ")).toBeUndefined();
  });
});

describe("listAuthorIdsInFlow", () => {
  it("collects distinct author ids in first-seen row order", () => {
    const flow = flowWith([
      rowFromContents(["A", "", ""], { authorId: "sam" }),
      rowFromContents(["B", "", ""], { authorId: "alex" }),
      rowFromContents(["C", "", ""], { authorId: "sam" }),
      rowFromContents(["D", "", ""]),
    ]);
    expect(listAuthorIdsInFlow(flow)).toEqual(["sam", "alex"]);
  });
});
