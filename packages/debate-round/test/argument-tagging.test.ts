import { describe, expect, it } from "vitest";
import {
  formatArgumentTags,
  getRowArgumentTags,
  inferArgumentType,
  listAuthorIdsInFlow,
  setRowArgumentTags,
} from "../src/flow/argument-tagging";
import type { Box, Flow } from "../src/types/flow";

function box(overrides: Partial<Box> = {}): Box {
  return {
    content: "content",
    children: [],
    index: 0,
    level: 0,
    focus: false,
    ...overrides,
  };
}

function flowWithRows(rows: Box[]): Pick<Flow, "children"> {
  return { children: rows };
}

describe("getRowArgumentTags", () => {
  it("reads whatever tags are set on the row's root box", () => {
    const flow = flowWithRows([box({ argumentType: "turn", authorId: "alex", evidenceStatus: "cited" })]);
    expect(getRowArgumentTags(flow, 0)).toEqual({
      argumentType: "turn",
      authorId: "alex",
      evidenceStatus: "cited",
    });
  });

  it("returns an empty object when no tags are set", () => {
    const flow = flowWithRows([box()]);
    expect(getRowArgumentTags(flow, 0)).toEqual({
      argumentType: undefined,
      authorId: undefined,
      evidenceStatus: undefined,
    });
  });

  it("returns an empty object for an out-of-range row", () => {
    const flow = flowWithRows([box()]);
    expect(getRowArgumentTags(flow, 5)).toEqual({});
    expect(getRowArgumentTags(flow, -1)).toEqual({});
  });
});

describe("setRowArgumentTags", () => {
  it("sets all three tags on the targeted row without touching other rows", () => {
    const flow = flowWithRows([box({ content: "row 0" }), box({ content: "row 1" })]);
    const updated = setRowArgumentTags(flow, 1, {
      argumentType: "impact",
      authorId: "jamie",
      evidenceStatus: "contested",
    });
    expect(updated.children[0]).toEqual(flow.children[0]);
    expect(updated.children[1]).toMatchObject({
      content: "row 1",
      argumentType: "impact",
      authorId: "jamie",
      evidenceStatus: "contested",
    });
  });

  it("does not mutate the original flow or box", () => {
    const original = box({ content: "row 0" });
    const flow = flowWithRows([original]);
    setRowArgumentTags(flow, 0, { argumentType: "link" });
    expect(original.argumentType).toBeUndefined();
  });

  it("clears a tag when it is omitted from the new tags", () => {
    const flow = flowWithRows([box({ argumentType: "turn", authorId: "alex", evidenceStatus: "cited" })]);
    const updated = setRowArgumentTags(flow, 0, { argumentType: "answer" });
    expect(updated.children[0].argumentType).toBe("answer");
    expect(updated.children[0].authorId).toBeUndefined();
    expect(updated.children[0].evidenceStatus).toBeUndefined();
  });

  it("trims a contributor id and clears it when it is whitespace-only", () => {
    const flow = flowWithRows([box()]);
    const trimmed = setRowArgumentTags(flow, 0, { authorId: "  alex  " });
    expect(trimmed.children[0].authorId).toBe("alex");

    const withAuthor = flowWithRows([box({ authorId: "alex" })]);
    const cleared = setRowArgumentTags(withAuthor, 0, { authorId: "   " });
    expect(cleared.children[0].authorId).toBeUndefined();
  });

  it("is a no-op for an out-of-range row index", () => {
    const flow = flowWithRows([box()]);
    expect(setRowArgumentTags(flow, 5, { argumentType: "turn" })).toBe(flow);
    expect(setRowArgumentTags(flow, -1, { argumentType: "turn" })).toBe(flow);
  });
});

describe("formatArgumentTags", () => {
  it("joins set tags in type/evidence/author order", () => {
    expect(formatArgumentTags({ argumentType: "link", evidenceStatus: "cited", authorId: "alex" })).toBe(
      "link · cited · alex",
    );
  });

  it("skips unset fields", () => {
    expect(formatArgumentTags({ argumentType: "turn" })).toBe("turn");
    expect(formatArgumentTags({})).toBe("");
  });
});

describe("listAuthorIdsInFlow", () => {
  it("lists distinct author ids in first-seen row order", () => {
    const flow = flowWithRows([
      box({ authorId: "alex" }),
      box({ authorId: "jamie" }),
      box({ authorId: "alex" }),
      box(),
    ]);
    expect(listAuthorIdsInFlow(flow)).toEqual(["alex", "jamie"]);
  });

  it("returns an empty array when no row has an author id", () => {
    expect(listAuthorIdsInFlow(flowWithRows([box(), box()]))).toEqual([]);
  });
});

describe("inferArgumentType", () => {
  it("matches each keyword rule", () => {
    expect(inferArgumentType("this extends our earlier point")).toBe("extension");
    expect(inferArgumentType("we answer their case with this")).toBe("answer");
    expect(inferArgumentType("the impact is extinction")).toBe("impact");
    expect(inferArgumentType("the link is uniqueness")).toBe("link");
    expect(inferArgumentType("this is our contention")).toBe("contention");
  });

  it("prioritizes the most specific rule when multiple keywords appear", () => {
    expect(inferArgumentType("this turns their impact")).toBe("turn");
  });

  it("is case-insensitive", () => {
    expect(inferArgumentType("THIS TURNS THE CASE")).toBe("turn");
  });

  it("returns undefined for empty, whitespace-only, or unmatched content", () => {
    expect(inferArgumentType("")).toBeUndefined();
    expect(inferArgumentType("   ")).toBeUndefined();
    expect(inferArgumentType("just a plain claim with no keyword")).toBeUndefined();
  });
});
