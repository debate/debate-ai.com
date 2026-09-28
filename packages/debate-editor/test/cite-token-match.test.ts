import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { Fragment } from "prosemirror-model";

import { foldForTokenMatch, markCiteTokensInText } from "../src/editor/cite-token-match";
import { schema } from "../src/schema/index";

const citeType = schema.marks["cite_mark"]!;

function setup(text: string) {
  const para = schema.nodes["paragraph"]!.create(null, schema.text(text));
  const doc = schema.nodes["doc"]!.create(null, Fragment.from(para));
  const state = EditorState.create({ schema, doc });
  return { state, tr: state.tr, start: 1 };
}

function markedText(tr: ReturnType<typeof setup>["tr"]): string[] {
  const out: string[] = [];
  tr.doc.descendants((node) => {
    if (node.isText && citeType.isInSet(node.marks)) out.push(node.text!);
    return true;
  });
  return out;
}

describe("foldForTokenMatch", () => {
  it("folds quotes, dashes, NBSP and case one-for-one", () => {
    const input = "‘A’ “B” –—− X Y ʼ";
    const folded = foldForTokenMatch(input);
    expect(folded).toBe("'a' \"b\" --- x y '");
    expect(folded.length).toBe(input.length);
  });

  it("keeps characters whose lowercase changes length", () => {
    // U+0130 lowercases to two code units; it must stay as-is.
    expect(foldForTokenMatch("İ")).toBe("İ");
  });
});

describe("markCiteTokensInText", () => {
  it("marks every occurrence of a token, case-insensitively", () => {
    const text = "Smith 24, citing SMITH 24";
    const { tr, start } = setup(text);
    const n = markCiteTokensInText(tr, start, text, ["smith 24"], citeType);
    expect(n).toBe(1);
    expect(markedText(tr)).toEqual(["Smith 24", "SMITH 24"]);
  });

  it("matches across typographic drift", () => {
    const text = "O’Neil–Jones 2024";
    const { tr, start } = setup(text);
    expect(markCiteTokensInText(tr, start, text, ["o'neil-jones 2024"], citeType)).toBe(1);
    expect(markedText(tr)).toEqual([text]);
  });

  it("retries with edge punctuation trimmed", () => {
    const text = "Brown 19 writes";
    const { tr, start } = setup(text);
    expect(markCiteTokensInText(tr, start, text, ['"Brown 19,"'], citeType)).toBe(1);
    expect(markedText(tr)).toEqual(["Brown 19"]);
  });

  it("skips empty tokens and counts misses as zero", () => {
    const text = "Lee 21";
    const { tr, start } = setup(text);
    expect(markCiteTokensInText(tr, start, text, ["", "Kim 20"], citeType)).toBe(0);
    expect(markedText(tr)).toEqual([]);
  });

  it("never marks past the end of the cite window", () => {
    const text = "Lee 21 Lee 21";
    const { tr, start } = setup(text);
    // Tell it the cite is only the first 6 characters.
    expect(markCiteTokensInText(tr, start, text.slice(0, 6), ["lee 21"], citeType)).toBe(1);
    expect(markedText(tr)).toEqual(["Lee 21"]);
  });
});
