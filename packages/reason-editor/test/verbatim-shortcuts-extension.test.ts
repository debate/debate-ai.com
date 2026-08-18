import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Editor } from "@tiptap/core";
import { schema } from "../src/engine/schema/index";
import { buildHeadingOutline } from "../src/engine/outline/heading-outline";
import {
  condenseDocument,
  insertShortCiteViaPrompt,
  moveCurrentHeadingSection,
} from "../src/react/verbatim-shortcuts-extension";

/** Same fixture shape as heading-move.test.ts. */
function buildDoc() {
  return schema.node("doc", null, [
    schema.node("pocket", { id: "case" }, schema.text("Case")),
    schema.node("hat", { id: "off" }, schema.text("Off")),
    schema.node("block", { id: "da" }, schema.text("DA")),
    schema.node("paragraph", null, schema.text("DA intro")),
    schema.node("hat", { id: "ac" }, schema.text("AC")),
  ]);
}

/** A minimal fake `Editor` exposing only what the shortcut commands touch. */
function fakeEditor(state: EditorState, overrides: Partial<Editor> = {}): Editor {
  return {
    state,
    view: { dispatch: vi.fn() },
    commands: {
      focus: vi.fn(),
      setContent: vi.fn(),
      toggleMark: vi.fn(),
    },
    getHTML: vi.fn(() => ""),
    ...overrides,
  } as unknown as Editor;
}

describe("moveCurrentHeadingSection", () => {
  it("moves the section the cursor is currently in", () => {
    const doc = buildDoc();
    const outline = buildHeadingOutline(doc);
    const da = outline.find((h) => h.id === "da")!;
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, da.endPos + 2) });
    const editor = fakeEditor(state);

    expect(moveCurrentHeadingSection(editor, "down")).toBe(true);
    expect(editor.view.dispatch).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the move would go out of bounds", () => {
    const doc = buildDoc();
    // Cursor inside the very first heading's section — nothing to swap up with.
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 1) });
    const editor = fakeEditor(state);

    expect(moveCurrentHeadingSection(editor, "up")).toBe(false);
    expect(editor.view.dispatch).not.toHaveBeenCalled();
  });
});

describe("insertShortCiteViaPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function editorWithEmptyParagraph() {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [])]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.create(doc, 1) });
    return fakeEditor(state);
  }

  it("prompts for author/year and inserts the formatted tag", () => {
    const responses = ["Smith", "2024"];
    vi.stubGlobal("prompt", vi.fn(() => responses.shift() ?? null));
    const editor = editorWithEmptyParagraph();

    expect(insertShortCiteViaPrompt(editor)).toBe(true);
    expect(editor.view.dispatch).toHaveBeenCalledTimes(1);
    expect(editor.commands.focus).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the author prompt is left blank", () => {
    vi.stubGlobal("prompt", vi.fn(() => "  "));
    const editor = editorWithEmptyParagraph();

    expect(insertShortCiteViaPrompt(editor)).toBe(false);
    expect(editor.view.dispatch).not.toHaveBeenCalled();
  });

  it("is a no-op when prompt is unavailable", () => {
    vi.stubGlobal("prompt", undefined);
    const editor = editorWithEmptyParagraph();

    expect(insertShortCiteViaPrompt(editor)).toBe(false);
  });
});

describe("condenseDocument", () => {
  it("replaces the document with its condensed html", () => {
    const html = "Intro not read. <u>This is read</u> Not read trailing.";
    const editor = fakeEditor(EditorState.create({ schema, doc: buildDoc() }), {
      getHTML: vi.fn(() => html),
    } as Partial<Editor>);

    expect(condenseDocument(editor)).toBe(true);
    expect(editor.commands.setContent).toHaveBeenCalledWith("<u>This is read</u>");
  });

  it("is a no-op when nothing is underlined", () => {
    const html = "<p>No underlined content here.</p>";
    const editor = fakeEditor(EditorState.create({ schema, doc: buildDoc() }), {
      getHTML: vi.fn(() => html),
    } as Partial<Editor>);

    expect(condenseDocument(editor)).toBe(false);
    expect(editor.commands.setContent).not.toHaveBeenCalled();
  });
});
