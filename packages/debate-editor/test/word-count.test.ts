import { describe, expect, it } from "vitest";
import { Fragment, type Mark, type Node as PMNode } from "prosemirror-model";

import {
  countReadAloudSplit,
  countReadAloudWords,
  formatNumber,
  formatReadTime,
  formatReadTimeFor,
  readTimeSeconds,
  totalWords,
} from "../src/editor/word-count";
import { schema } from "../src/schema/index";

const hl = () => schema.marks["highlight"]!.create();
const shade = () => schema.marks["shading"]!.create({ color: "D2D2D2" });
const cite = () => schema.marks["cite_mark"]!.create();

const t = (text: string, marks: Mark[] = []) => schema.text(text, marks);
const block = (name: string, ...content: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(content));
const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

describe("countReadAloudSplit", () => {
  it("buckets tag/analytic/cite as other and highlighted body text as body", () => {
    const d = doc(
      schema.nodes["card"]!.create(null, [
        block("tag", t("the tag line")),
        block("cite_paragraph", t("Smith 24", [cite()]), t(" unread filler "), t("read in full", [hl()])),
        block("card_body", t("not read "), t("read this", [hl()]), t(" shaded", [hl(), shade()])),
      ]),
      schema.nodes["analytic_unit"]!.create(null, [block("analytic", t("an analytic"))]),
      block("paragraph", t("plain "), t("marked", [hl()])),
      block("undertag", t("cite style", [cite()])),
    );
    expect(countReadAloudSplit(d)).toEqual({ body: 6, other: 9 });
    expect(countReadAloudWords(d)).toBe(15);
  });

  it("counts only the requested window", () => {
    const d = doc(block("paragraph", t("one two three four", [hl()])));
    // Paragraph content starts at 1: "one two" spans [1, 8).
    expect(countReadAloudSplit(d, 1, 8)).toEqual({ body: 2, other: 0 });
    expect(countReadAloudWords(d, 5, 5)).toBe(0);
    expect(countReadAloudWords(d, 8, 1)).toBe(0);
  });

  it("ignores whitespace-only runs and unmarked cite filler", () => {
    const d = doc(block("tag", t("   ")), block("cite_paragraph", t("filler")));
    expect(countReadAloudWords(d)).toBe(0);
  });
});

describe("read time", () => {
  it("totals split counts", () => {
    expect(totalWords({ body: 3, other: 4 })).toBe(7);
  });

  it("uses wpm for everything when tagWpm is blank", () => {
    expect(readTimeSeconds({ body: 100, other: 50 }, { wpm: 300 })).toBe(30);
  });

  it("reads structural words at tagWpm when set", () => {
    expect(readTimeSeconds({ body: 300, other: 100 }, { wpm: 300, tagWpm: 100 })).toBe(120);
    // Invalid tagWpm falls back to wpm.
    expect(readTimeSeconds({ body: 300, other: 100 }, { wpm: 300, tagWpm: 0 })).toBe(80);
  });

  it("returns null without a usable rate", () => {
    expect(readTimeSeconds({ body: 1, other: 1 }, { wpm: 0 })).toBeNull();
    expect(readTimeSeconds({ body: 1, other: 1 }, { wpm: Number.NaN })).toBeNull();
    expect(formatReadTimeFor({ body: 1, other: 1 }, { wpm: -1 })).toBe("—");
  });

  it("formats as M:SS", () => {
    expect(formatReadTimeFor({ body: 325, other: 0 }, { wpm: 300 })).toBe("1:05");
    expect(formatReadTime(150, 300)).toBe("0:30");
    expect(formatReadTime(10, 0)).toBe("—");
  });

  it("formats numbers with separators", () => {
    expect(formatNumber(1024)).toBe("1,024");
  });
});
