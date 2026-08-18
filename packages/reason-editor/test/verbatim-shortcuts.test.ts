import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { schema } from "../src/engine/schema/index";
import {
  applyCondenseToHtml,
  buildInsertShortCiteTransaction,
} from "../src/engine/verbatim-shortcuts";

describe("applyCondenseToHtml", () => {
  it("condenses to the underlined read text", () => {
    const html = "Intro not read. <u>This is read</u> Not read trailing.";
    expect(applyCondenseToHtml(html)).toBe("<u>This is read</u>");
  });

  it("joins non-adjacent underlined runs with an ellipsis", () => {
    const html = "<u>Part one</u> skipped <u>part two</u>";
    expect(applyCondenseToHtml(html)).toBe("<u>Part one</u> … <u>part two</u>");
  });

  it("falls back to the original html when nothing is underlined", () => {
    const html = "<p>No underlined content here.</p>";
    expect(applyCondenseToHtml(html)).toBe(html);
  });

  it("falls back to the original (empty) html for empty input", () => {
    expect(applyCondenseToHtml("")).toBe("");
  });
});

function stateWithParagraph(text: string) {
  const content = text ? [schema.text(text)] : [];
  const doc = schema.node("doc", null, [schema.node("paragraph", null, content)]);
  // Position 1 is right after the paragraph's opening tag — the start of
  // its text content.
  const selection = TextSelection.create(doc, 1);
  return EditorState.create({ schema, doc, selection });
}

describe("buildInsertShortCiteTransaction", () => {
  it("inserts a short cite tag with a year, marked cite_mark", () => {
    const state = stateWithParagraph("");
    const tr = buildInsertShortCiteTransaction(state, "Smith", 2024);
    expect(tr).not.toBeNull();

    const next = state.apply(tr!).doc;
    expect(next.textContent).toBe("Smith 24");

    const citeType = schema.marks["cite_mark"]!;
    const paragraph = next.child(0);
    expect(citeType.isInSet(paragraph.child(0).marks)).toBeTruthy();
  });

  it("formats an undated cite as ND", () => {
    const state = stateWithParagraph("");
    const tr = buildInsertShortCiteTransaction(state, "Smith", "ND");
    const next = state.apply(tr!).doc;
    expect(next.textContent).toBe("Smith ND");
  });

  it("replaces the current selection instead of just inserting", () => {
    const state = stateWithParagraph("old text");
    const withSelection = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 1 + "old text".length)),
    );
    const tr = buildInsertShortCiteTransaction(withSelection, "Jones", 2025);
    const next = withSelection.apply(tr!).doc;
    expect(next.textContent).toBe("Jones 25");
  });

  it("returns null for a blank author", () => {
    const state = stateWithParagraph("");
    expect(buildInsertShortCiteTransaction(state, "", 2024)).toBeNull();
    expect(buildInsertShortCiteTransaction(state, "   ", 2024)).toBeNull();
  });
});
