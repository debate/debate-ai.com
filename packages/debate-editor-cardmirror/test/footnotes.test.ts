import { describe, expect, it } from "vitest";
import {
  footnotePlainText,
  plainTextToFootnoteContent,
} from "../src/schema/footnotes";
import type { FootnoteContent } from "../src/schema/footnotes";

describe("footnotePlainText", () => {
  it("joins runs within a paragraph and paragraphs with newlines", () => {
    const content: FootnoteContent = [
      [{ text: "Hello, " }, { text: "world." }],
      [{ text: "Second para." }],
    ];
    expect(footnotePlainText(content)).toBe("Hello, world.\nSecond para.");
  });

  it("returns empty string for empty content", () => {
    expect(footnotePlainText([])).toBe("");
  });

  it("treats an empty paragraph as an empty line", () => {
    const content: FootnoteContent = [[{ text: "A" }], [], [{ text: "B" }]];
    expect(footnotePlainText(content)).toBe("A\n\nB");
  });
});

describe("plainTextToFootnoteContent", () => {
  it("produces one run per non-empty line", () => {
    const result = plainTextToFootnoteContent("Line one\nLine two");
    expect(result).toEqual([[{ text: "Line one" }], [{ text: "Line two" }]]);
  });

  it("round-trips through footnotePlainText for simple multi-line text", () => {
    const text = "Alpha\nBeta\nGamma";
    const content = plainTextToFootnoteContent(text);
    expect(footnotePlainText(content)).toBe(text);
  });

  it("keeps an interior blank line but drops leading/trailing blank lines", () => {
    const result = plainTextToFootnoteContent("\nMiddle\n\nMore\n");
    // Leading "" and trailing "" are filtered; the interior blank between
    // Middle and More is preserved.
    expect(result).toEqual([[{ text: "Middle" }], [], [{ text: "More" }]]);
  });

  it("returns an empty array for an empty string", () => {
    // A single blank line, at index 0 which is also the last index -> filtered.
    expect(plainTextToFootnoteContent("")).toEqual([]);
  });

  it("returns an empty array for a single newline", () => {
    // Two blank lines: index 0 (first) and index 1 (last) — both filtered.
    expect(plainTextToFootnoteContent("\n")).toEqual([]);
  });
});
