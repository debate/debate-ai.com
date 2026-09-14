import { describe, expect, it } from "vitest";
import { extractMarked, extractUnderlined } from "../src/extractors/text-extractor";

describe("extractMarked", () => {
  it("joins the highlighted runs with an ellipsis by default", () => {
    expect(extractMarked("<mark>a</mark> mid <mark>b</mark>")).toBe("a…b");
  });

  it("joins them with a space when the caller asks", () => {
    expect(extractMarked("<mark>a</mark> mid <mark>b</mark>", false)).toBe("a b");
  });

  it("strips the tags inside a highlighted run", () => {
    expect(extractMarked("<mark>a <b>bold</b> word</mark>")).toBe("a bold word");
  });

  it("collapses the whitespace inside a run", () => {
    expect(extractMarked("<mark>a \n  b</mark>")).toBe("a b");
  });

  it("skips a run holding no text", () => {
    expect(extractMarked("<mark> </mark><mark>a</mark>")).toBe("a");
  });

  it("reads a highlight tag carrying attributes", () => {
    expect(extractMarked('<mark class="hl">a</mark>')).toBe("a");
  });

  it("reads the tag in either case", () => {
    expect(extractMarked("<MARK>a</MARK>")).toBe("a");
  });

  it("is empty when nothing is highlighted", () => {
    expect(extractMarked("<p>plain</p>")).toBe("");
    expect(extractMarked("")).toBe("");
  });

  it("is empty for an unclosed highlight, which names no run", () => {
    expect(extractMarked("<mark>a")).toBe("");
  });
});

describe("extractUnderlined", () => {
  it("returns each underlined segment separately", () => {
    expect(extractUnderlined("<u>a</u> mid <u>b</u>")).toEqual(["a", "b"]);
  });

  it("keeps a multi-line segment as one entry, with its whitespace collapsed", () => {
    expect(extractUnderlined("<u>a\n  b</u>")).toEqual(["a b"]);
  });

  it("does not confuse the highlight tag for the underline one", () => {
    expect(extractUnderlined("<mark>a</mark>")).toEqual([]);
  });

  it("is empty when nothing is underlined", () => {
    expect(extractUnderlined("<p>plain</p>")).toEqual([]);
    expect(extractUnderlined("")).toEqual([]);
  });
});
