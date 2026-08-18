import { describe, expect, it } from "vitest";
import {
  condenseCardHtml,
  formatShortCiteTag,
  moveOutlineNode,
  toggleEmphasisHtml,
} from "../src/utils/verbatim-shortcuts";
import type { Card, OutlineItem, OutlineNode } from "../src/types/types";

describe("condenseCardHtml", () => {
  it("returns empty string for empty input", () => {
    expect(condenseCardHtml("")).toBe("");
  });

  it("returns empty string when nothing is underlined", () => {
    expect(condenseCardHtml("<p>No underlined content here.</p>")).toBe("");
  });

  it("strips surrounding non-underlined text around a single run", () => {
    const html = "Intro not read. <u>This is read</u> Not read trailing.";
    expect(condenseCardHtml(html)).toBe("<u>This is read</u>");
  });

  it("preserves nested emphasis markup inside the underlined run", () => {
    const html = "<u>Some <mark>emphasized</mark> text</u>";
    expect(condenseCardHtml(html)).toBe(html);
  });

  it("joins adjacent underlined runs with a plain space", () => {
    const html = "<u>Part one</u> <u>part two</u>";
    expect(condenseCardHtml(html)).toBe("<u>Part one</u> <u>part two</u>");
  });

  it("joins non-adjacent underlined runs with an ellipsis", () => {
    const html = "<u>Part one</u> some skipped text <u>part two</u>";
    expect(condenseCardHtml(html)).toBe(
      "<u>Part one</u> … <u>part two</u>",
    );
  });

  it("supports a custom ellipsis separator", () => {
    const html = "<u>Part one</u> skipped <u>part two</u>";
    expect(condenseCardHtml(html, { ellipsis: " || " })).toBe(
      "<u>Part one</u> || <u>part two</u>",
    );
  });

  it("treats a single run with only whitespace/tags around it as adjacent", () => {
    const html = "<p></p><u>Only run</u><br/>";
    expect(condenseCardHtml(html)).toBe("<u>Only run</u>");
  });
});

describe("formatShortCiteTag", () => {
  it("formats a two-digit year tag", () => {
    expect(formatShortCiteTag({ author: "Smith", year: 2024 })).toBe(
      "Smith 24",
    );
  });

  it("zero-pads single-digit year remainders", () => {
    expect(formatShortCiteTag({ author: "Smith", year: 2004 })).toBe(
      "Smith 04",
    );
  });

  it("handles pre-2000 years", () => {
    expect(formatShortCiteTag({ author: "Smith", year: 1998 })).toBe(
      "Smith 98",
    );
  });

  it("falls back to ND for an explicit no-date year", () => {
    expect(formatShortCiteTag({ author: "Smith", year: "ND" })).toBe(
      "Smith ND",
    );
  });

  it("falls back to ND when year is missing", () => {
    expect(formatShortCiteTag({ author: "Smith", year: null })).toBe(
      "Smith ND",
    );
    expect(formatShortCiteTag({ author: "Smith" })).toBe("Smith ND");
  });

  it("trims author whitespace", () => {
    expect(formatShortCiteTag({ author: "  Smith  ", year: 2024 })).toBe(
      "Smith 24",
    );
  });

  it("returns null when there is no author to cite", () => {
    expect(formatShortCiteTag({ author: null, year: 2024 })).toBeNull();
    expect(formatShortCiteTag({ author: "   ", year: 2024 })).toBeNull();
  });
});

describe("moveOutlineNode", () => {
  const heading = (text: string): OutlineItem => ({ type: 1, text });
  const card = (summary: string): Card => ({
    summary,
    author: "Author",
    author_type: 1,
    cite: "Cite",
    year: 2024,
    url: null,
  });

  const outline: OutlineNode[] = [heading("A"), card("B"), heading("C")];

  it("swaps a node with the previous one when moving up", () => {
    const result = moveOutlineNode(outline, 1, "up");
    expect(result).toEqual([card("B"), heading("A"), heading("C")]);
    expect(result).not.toBe(outline);
  });

  it("swaps a node with the next one when moving down", () => {
    const result = moveOutlineNode(outline, 1, "down");
    expect(result).toEqual([heading("A"), heading("C"), card("B")]);
  });

  it("does not mutate the original outline", () => {
    const original = outline.slice();
    moveOutlineNode(outline, 1, "up");
    expect(outline).toEqual(original);
  });

  it("returns the same array reference when moving the first node up", () => {
    const result = moveOutlineNode(outline, 0, "up");
    expect(result).toBe(outline);
  });

  it("returns the same array reference when moving the last node down", () => {
    const result = moveOutlineNode(outline, outline.length - 1, "down");
    expect(result).toBe(outline);
  });

  it("returns the same array reference for an out-of-range index", () => {
    expect(moveOutlineNode(outline, -1, "up")).toBe(outline);
    expect(moveOutlineNode(outline, outline.length, "down")).toBe(outline);
  });

  it("is generic — works against a caller's own outline-shaped entries", () => {
    // e.g. reason-editor's live-document `OutlineHeading`, which has no
    // relation to this module's `Card`/`OutlineItem` types.
    interface HeadingLike {
      id: string;
      level: number;
    }
    const headings: HeadingLike[] = [
      { id: "a", level: 1 },
      { id: "b", level: 2 },
      { id: "c", level: 2 },
    ];
    expect(moveOutlineNode(headings, 1, "down")).toEqual([
      { id: "a", level: 1 },
      { id: "c", level: 2 },
      { id: "b", level: 2 },
    ]);
  });
});

describe("toggleEmphasisHtml", () => {
  it("wraps an unmarked selection in <mark>", () => {
    expect(toggleEmphasisHtml("Hello world", 6, 11)).toBe("Hello <mark>world</mark>");
  });

  it("wraps a selection starting at the beginning of the text", () => {
    expect(toggleEmphasisHtml("Hello world", 0, 5)).toBe("<mark>Hello</mark> world");
  });

  it("removes an existing <mark> pair when the selection exactly matches it", () => {
    const html = "Hello <mark>world</mark>";
    expect(toggleEmphasisHtml(html, 6, 11)).toBe("Hello world");
  });

  it("is idempotent: wrapping then unwrapping returns the original html", () => {
    const html = "Hello world";
    const wrapped = toggleEmphasisHtml(html, 6, 11);
    expect(toggleEmphasisHtml(wrapped, 6, 11)).toBe(html);
  });

  it("merges a wider selection that only partially overlaps an existing mark", () => {
    const html = "Hello <mark>wor</mark>ld";
    // Visible text is "Hello world"; select "world" (offsets 6-11), which
    // only partially covers the existing "wor" mark.
    expect(toggleEmphasisHtml(html, 6, 11)).toBe("Hello <mark>world</mark>");
  });

  it("addresses offsets by visible text, ignoring surrounding tags", () => {
    const html = "<u>Hello world</u>";
    expect(toggleEmphasisHtml(html, 6, 11)).toBe("<u>Hello <mark>world</mark></u>");
  });

  it("is a no-op for a collapsed selection", () => {
    expect(toggleEmphasisHtml("Hello world", 4, 4)).toBe("Hello world");
  });

  it("normalizes a reversed selection", () => {
    expect(toggleEmphasisHtml("Hello world", 11, 6)).toBe("Hello <mark>world</mark>");
  });

  it("clamps out-of-range offsets to the visible text bounds", () => {
    expect(toggleEmphasisHtml("Hello", -5, 100)).toBe("<mark>Hello</mark>");
  });

  it("wraps the whole string when fully selected", () => {
    expect(toggleEmphasisHtml("Hello", 0, 5)).toBe("<mark>Hello</mark>");
  });
});
