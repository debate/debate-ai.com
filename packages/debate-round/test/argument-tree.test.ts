import { describe, expect, it } from "vitest";
import {
  buildArgumentTree,
  filterArgumentTree,
  flattenArgumentTree,
  getFlowSideKeys,
  getSpeechSideKey,
} from "../src/flow/argument-tree";
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

describe("getSpeechSideKey", () => {
  it("strips a leading speech-number digit and uppercases the side letter", () => {
    expect(getSpeechSideKey("1AC")).toBe("A");
    expect(getSpeechSideKey("2NC")).toBe("N");
    expect(getSpeechSideKey("1NR")).toBe("N");
  });

  it("works for column names with no leading digit", () => {
    expect(getSpeechSideKey("AC")).toBe("A");
    expect(getSpeechSideKey("P1")).toBe("P");
    expect(getSpeechSideKey("1OC")).toBe("O");
  });

  it("returns null when there's no leading letter run", () => {
    expect(getSpeechSideKey("123")).toBeNull();
    expect(getSpeechSideKey("")).toBeNull();
  });
});

describe("getFlowSideKeys", () => {
  it("returns distinct side keys in column order", () => {
    expect(getFlowSideKeys({ columns: ["1AC", "1NC", "2AC", "2NC"] })).toEqual(["A", "N"]);
  });

  it("dedupes repeated side keys across many columns", () => {
    expect(getFlowSideKeys({ columns: ["P1", "O1", "P2", "O2", "PW", "OW"] })).toEqual(["P", "O"]);
  });
});

describe("buildArgumentTree", () => {
  it("nests non-heading rows under the most recent heading above them", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Case advantage", "Turn", "", ""]),
        rowFromContents(["Off-case", "", "", ""], { isHeading: true }),
        rowFromContents(["Disad link", "", "", ""]),
        rowFromContents(["Topicality", "", "", ""]),
      ],
    };

    const tree = buildArgumentTree(flow);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ isHeading: false, content: "Case advantage", children: [] });
    expect(tree[1]).toMatchObject({ isHeading: true, content: "Off-case" });
    expect(tree[1].children.map((n) => n.content)).toEqual(["Disad link", "Topicality"]);
  });

  it("skips rows with no flowed content in any column", () => {
    const flow = {
      columns: COLUMNS,
      children: [rowFromContents(["", "", "", ""]), rowFromContents(["Case advantage", "", "", ""])],
    };

    expect(buildArgumentTree(flow).map((n) => n.content)).toEqual(["Case advantage"]);
  });

  it("derives sideKey for argument rows and leaves it null for headings", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Off-case", "", "", ""], { isHeading: true }),
        rowFromContents(["Disad link", "", "", ""]),
      ],
    };

    const tree = buildArgumentTree(flow);
    expect(tree[0].sideKey).toBeNull();
    expect(tree[0].children[0].sideKey).toBe("A");
  });

  it("carries argumentType/authorId/evidenceStatus through from the row's Box", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Disad link", "", "", ""], {
          argumentType: "link",
          authorId: "debater-1",
          evidenceStatus: "contested",
        }),
      ],
    };

    const tree = buildArgumentTree(flow);
    expect(tree[0]).toMatchObject({
      argumentType: "link",
      authorId: "debater-1",
      evidenceStatus: "contested",
    });
  });

  it("leaves argumentType/authorId/evidenceStatus undefined when not set on the Box", () => {
    const flow = {
      columns: COLUMNS,
      children: [rowFromContents(["Case advantage", "", "", ""])],
    };

    const tree = buildArgumentTree(flow);
    expect(tree[0].argumentType).toBeUndefined();
    expect(tree[0].authorId).toBeUndefined();
    expect(tree[0].evidenceStatus).toBeUndefined();
  });
});

describe("filterArgumentTree", () => {
  const flow = {
    columns: COLUMNS,
    children: [
      rowFromContents(["On-case", "", "", ""], { isHeading: true }),
      rowFromContents(["Case advantage", "Turn", "Extend", "Frontline"]), // 1AC -> 2NC, answered
      rowFromContents(["Off-case", "", "", ""], { isHeading: true }),
      rowFromContents(["Disad link", "", "", ""]), // 1AC, unanswered
      rowFromContents(["", "Neg-only point", "", "Neg frontline"]), // 1NC -> 2NC, answered
    ],
  };
  const tree = buildArgumentTree(flow);

  it("filters by sideKey, dropping a heading left with no matching children", () => {
    const filtered = filterArgumentTree(tree, { sideKey: "N" });
    expect(filtered.map((n) => n.content)).toEqual(["Off-case"]);
    expect(flattenArgumentTree(filtered).map((n) => n.content)).toEqual([
      "Off-case",
      "Neg-only point",
    ]);
  });

  it("filters by speech across origin and last speech", () => {
    const filtered = filterArgumentTree(tree, { speech: "1NC" });
    expect(filtered.map((n) => n.content)).toEqual(["Off-case"]);
    expect(filtered[0].children.map((n) => n.content)).toEqual(["Neg-only point"]);
  });

  it("filters to only unanswered rows, keeping the heading that groups one", () => {
    const filtered = filterArgumentTree(tree, { onlyUnanswered: true });
    expect(filtered.map((n) => n.content)).toEqual(["Off-case"]);
    expect(filtered[0].children.map((n) => n.content)).toEqual(["Disad link"]);
  });

  it("kind: 'heading' returns a pure outline with no children", () => {
    const filtered = filterArgumentTree(tree, { kind: "heading" });
    expect(filtered.map((n) => n.content)).toEqual(["On-case", "Off-case"]);
    expect(filtered.every((n) => n.children.length === 0)).toBe(true);
  });

  it("kind: 'argument' drops every heading wrapper, hoisting matching rows to the top level", () => {
    const filtered = filterArgumentTree(tree, { kind: "argument", speech: "1NC" });
    expect(filtered.map((n) => n.content)).toEqual(["Neg-only point"]);
    expect(filtered.every((n) => !n.isHeading)).toBe(true);
  });

  describe("filtering by argumentType/authorId/evidenceStatus", () => {
    const taggedFlow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Off-case", "", "", ""], { isHeading: true }),
        rowFromContents(["Disad link", "", "", ""], {
          argumentType: "link",
          authorId: "debater-1",
          evidenceStatus: "contested",
        }),
        rowFromContents(["Impact turn", "", "", ""], {
          argumentType: "turn",
          authorId: "debater-2",
          evidenceStatus: "cited",
        }),
      ],
    };
    const taggedTree = buildArgumentTree(taggedFlow);

    it("filters by argumentType, dropping a heading left with no matching children", () => {
      const filtered = filterArgumentTree(taggedTree, { argumentType: "turn" });
      expect(flattenArgumentTree(filtered).map((n) => n.content)).toEqual(["Off-case", "Impact turn"]);
    });

    it("filters by authorId", () => {
      const filtered = filterArgumentTree(taggedTree, { authorId: "debater-1" });
      expect(flattenArgumentTree(filtered).map((n) => n.content)).toEqual(["Off-case", "Disad link"]);
    });

    it("filters by evidenceStatus", () => {
      const filtered = filterArgumentTree(taggedTree, { evidenceStatus: "contested" });
      expect(flattenArgumentTree(filtered).map((n) => n.content)).toEqual(["Off-case", "Disad link"]);
    });

    it("combines with kind: 'argument' to hoist matching rows without their heading", () => {
      const filtered = filterArgumentTree(taggedTree, { kind: "argument", argumentType: "link" });
      expect(filtered.map((n) => n.content)).toEqual(["Disad link"]);
    });
  });
});

describe("flattenArgumentTree", () => {
  it("orders each heading immediately before its children", () => {
    const flow = {
      columns: COLUMNS,
      children: [
        rowFromContents(["Off-case", "", "", ""], { isHeading: true }),
        rowFromContents(["Disad link", "", "", ""]),
        rowFromContents(["Topicality", "", "", ""]),
        rowFromContents(["On-case", "", "", ""], { isHeading: true }),
        rowFromContents(["Case advantage", "", "", ""]),
      ],
    };

    const flat = flattenArgumentTree(buildArgumentTree(flow));
    expect(flat.map((n) => n.content)).toEqual([
      "Off-case",
      "Disad link",
      "Topicality",
      "On-case",
      "Case advantage",
    ]);
  });
});
