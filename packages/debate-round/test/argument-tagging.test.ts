import { describe, expect, it } from "vitest";
import {
  formatArgumentTags,
  getRowArgumentTags,
  listAuthorIdsInFlow,
  setRowArgumentTags,
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
