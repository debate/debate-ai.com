import { describe, expect, it } from "vitest";
import {
  argumentTreeOutlineFilename,
  buildArgumentTreeOutlineText,
} from "../src/flow/argument-tree-export";
import type { ArgumentTreeNode } from "../src/flow/argument-tree";

function heading(content: string): ArgumentTreeNode {
  return {
    id: `heading-${content}`,
    rowIndex: 0,
    isHeading: true,
    content,
    originSpeech: "1AC",
    lastSpeech: "1AC",
    sideKey: null,
    isUnanswered: false,
    entries: [],
    children: [],
  };
}

function argument(content: string, overrides: Partial<ArgumentTreeNode> = {}): ArgumentTreeNode {
  return {
    id: `row-${content}`,
    rowIndex: 1,
    isHeading: false,
    content,
    originSpeech: "1AC",
    lastSpeech: "1AC",
    sideKey: "A",
    isUnanswered: false,
    entries: [],
    children: [],
    ...overrides,
  };
}

describe("buildArgumentTreeOutlineText", () => {
  it("renders a header naming the round", () => {
    expect(buildArgumentTreeOutlineText([], "4")).toContain("Outline — Round 4");
  });

  it("returns a no-rows message when the filtered tree is empty", () => {
    expect(buildArgumentTreeOutlineText([], "4")).toBe(
      "Outline — Round 4\n\nNo rows match the current filter.",
    );
  });

  it("renders a heading row as a markdown-ish ## line", () => {
    const text = buildArgumentTreeOutlineText([heading("Case Overview")], "4");
    expect(text).toContain("## Case Overview");
  });

  it("renders an argument row with its origin speech and content, no tag suffix when untagged", () => {
    const text = buildArgumentTreeOutlineText([argument("Link argument")], "4");
    expect(text).toContain("- [1AC] Link argument");
    expect(text).not.toContain("(");
  });

  it("appends every set tag in a fixed order: type, by, evidence, unanswered", () => {
    const text = buildArgumentTreeOutlineText(
      [
        argument("Turns the case", {
          argumentType: "turn",
          authorId: "alex",
          evidenceStatus: "cited",
          isUnanswered: true,
        }),
      ],
      "4",
    );
    expect(text).toContain(
      "- [1AC] Turns the case (type: turn; by: alex; evidence: cited; unanswered)",
    );
  });

  it("only includes the tags that are actually set", () => {
    const text = buildArgumentTreeOutlineText(
      [argument("Contested impact", { evidenceStatus: "contested" })],
      "4",
    );
    expect(text).toContain("- [1AC] Contested impact (evidence: contested)");
  });

  it("renders multiple rows in order, one per line", () => {
    const text = buildArgumentTreeOutlineText(
      [heading("Off-case"), argument("First"), argument("Second")],
      "4",
    );
    expect(text.split("\n").filter(Boolean)).toEqual([
      "Outline — Round 4",
      "## Off-case",
      "- [1AC] First",
      "- [1AC] Second",
    ]);
  });
});

describe("argumentTreeOutlineFilename", () => {
  it("builds a filename from the round id", () => {
    expect(argumentTreeOutlineFilename("4")).toBe("outline-4.txt");
  });

  it("lowercases and collapses non-alphanumeric characters to single hyphens", () => {
    expect(argumentTreeOutlineFilename("Round #17 / Semis")).toBe("outline-round-17-semis.txt");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(argumentTreeOutlineFilename("  --Round 4--  ")).toBe("outline-round-4.txt");
  });

  it("falls back to 'round' when the id has no alphanumeric characters", () => {
    expect(argumentTreeOutlineFilename("###")).toBe("outline-round.txt");
  });
});
