import { describe, expect, it } from "vitest";
import {
  condenseCardHtml,
  formatShortCiteTag,
  moveOutlineNode,
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
});
