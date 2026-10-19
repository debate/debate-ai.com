import { describe, expect, it } from "vitest";
import {
  MAX_SUBMISSION_CONTENT_LENGTH,
  describeTopicStarterChange,
  emptyFolders,
  parseTopicStarterChange,
  planReorganize,
  sanitizeAssignments,
  type TopicTreeRow,
} from "../../../src/lib/topic-starters/changes";

const row = (id: number, title: string, parentId: number | null, isFolder = false): TopicTreeRow => ({ id, title, parentId, isFolder });

describe("parseTopicStarterChange", () => {
  it("reads each kind into the shape the server applies", () => {
    expect(parseTopicStarterChange({ kind: "move", itemId: "4", parentId: null })).toEqual({
      ok: true,
      change: { kind: "move", itemId: 4, parentId: null },
    });
    expect(parseTopicStarterChange({ kind: "rename", itemId: 4, title: "  Cap   K  " })).toEqual({
      ok: true,
      change: { kind: "rename", itemId: 4, title: "Cap K" },
    });
    expect(parseTopicStarterChange({ kind: "delete", itemId: 9 })).toEqual({ ok: true, change: { kind: "delete", itemId: 9 } });
    expect(parseTopicStarterChange({ kind: "create-folder", title: "Neg", parentId: -1 })).toEqual({
      ok: true,
      change: { kind: "create-folder", title: "Neg", parentId: null },
    });
    expect(parseTopicStarterChange({ kind: "submit", title: "Elections DA", content: "H4s", format: "cmir", parentId: 3, year: "2026" })).toEqual({
      ok: true,
      change: { kind: "submit", title: "Elections DA", content: "H4s", format: "cmir", parentId: 3, year: 2026 },
    });
  });

  it("refuses what it can't apply", () => {
    expect(parseTopicStarterChange(null)).toEqual({ ok: false, error: "Expected a change object." });
    expect(parseTopicStarterChange({ kind: "explode" })).toEqual({ ok: false, error: "Unknown change." });
    expect(parseTopicStarterChange({ kind: "move", itemId: 0 })).toMatchObject({ ok: false });
    expect(parseTopicStarterChange({ kind: "move", itemId: 5, parentId: 5 })).toMatchObject({ ok: false });
    expect(parseTopicStarterChange({ kind: "rename", itemId: 5, title: "   " })).toMatchObject({ ok: false });
    expect(parseTopicStarterChange({ kind: "submit", title: "Big", content: "x".repeat(MAX_SUBMISSION_CONTENT_LENGTH + 1) })).toMatchObject({
      ok: false,
      error: expect.stringContaining("too large"),
    });
    expect(parseTopicStarterChange({ kind: "reorganize", assignments: [{ itemId: 1, side: "both", type: "da" }] })).toMatchObject({ ok: false });
  });
});

describe("sanitizeAssignments", () => {
  it("keeps known sides and types, first assignment per file", () => {
    expect(
      sanitizeAssignments([
        { id: 1, side: "NEG", type: "DA" },
        { itemId: 1, side: "aff", type: "case" },
        { itemId: 2, side: "aff", type: "plan" },
        { itemId: 3, side: "aff", type: "k" },
        "junk",
      ]),
    ).toEqual([
      { itemId: 1, side: "neg", type: "da" },
      { itemId: 3, side: "aff", type: "k" },
    ]);
    expect(sanitizeAssignments("nope")).toEqual([]);
  });
});

describe("describeTopicStarterChange", () => {
  const titles = new Map([
    [1, "Warming 1AC"],
    [2, "Impacts"],
  ]);
  it("names items by their current titles", () => {
    expect(describeTopicStarterChange({ kind: "move", itemId: 1, parentId: 2 }, titles)).toBe("Move Warming 1AC to Impacts");
    expect(describeTopicStarterChange({ kind: "move", itemId: 7, parentId: null }, titles)).toBe("Move #7 to the top level");
    expect(describeTopicStarterChange({ kind: "delete", itemId: 2 }, titles)).toBe("Delete Impacts");
  });

  it("breaks a reorganization down by folder", () => {
    expect(
      describeTopicStarterChange({
        kind: "reorganize",
        assignments: [
          { itemId: 1, side: "aff", type: "case" },
          { itemId: 2, side: "neg", type: "da" },
          { itemId: 3, side: "neg", type: "da" },
        ],
      }),
    ).toBe("Organize 3 files by argument (Aff/Case 1, Neg/DA 2)");
  });
});

describe("planReorganize", () => {
  it("files each assigned file under Side/Type, creating only the folders that don't exist", () => {
    const rows = [
      row(1, "Old stuff", null, true),
      row(2, "Warming 1AC", 1),
      row(3, "Elections DA", 1),
      row(4, "neg", null, true), // reused despite the case
      row(5, "DA", 4, true),
      row(6, "Spending DA", 5), // already in place
      row(7, "A folder", null, true),
    ];
    const plan = planReorganize(rows, [
      { itemId: 2, side: "aff", type: "case" },
      { itemId: 3, side: "neg", type: "da" },
      { itemId: 6, side: "neg", type: "da" },
      { itemId: 7, side: "neg", type: "k" }, // a folder: never moved
      { itemId: 99, side: "neg", type: "k" }, // not in the tree
    ]);
    expect(plan.folders).toEqual([
      { path: ["Aff"], existingId: null },
      { path: ["Neg"], existingId: 4 },
      { path: ["Aff", "Case"], existingId: null },
      { path: ["Neg", "DA"], existingId: 5 },
    ]);
    expect(plan.moves).toEqual([
      { itemId: 2, path: ["Aff", "Case"] },
      { itemId: 3, path: ["Neg", "DA"] },
    ]);
  });
});

describe("emptyFolders", () => {
  it("reports folders with no file beneath them, sparing kept ones", () => {
    const rows = [
      row(1, "Empty", null, true),
      row(2, "Nested empty", 1, true),
      row(3, "Has file", null, true),
      row(4, "File", 3),
      row(5, "Aff", null, true),
      row(6, "Case", 5, true),
    ];
    expect(emptyFolders(rows, new Set([5, 6])).sort()).toEqual([1, 2]);
  });
});
