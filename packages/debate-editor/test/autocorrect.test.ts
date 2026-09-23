import { describe, expect, it } from "vitest";
import { EditorState, PluginKey, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Fragment, type Mark } from "prosemirror-model";

import {
  WORD_COMMIT_DELIMITER,
  makeAutocorrectPlugin,
  marksAreUniform,
  type AutocorrectRule,
  type AutocorrectState,
} from "../src/editor/autocorrect";
import { schema } from "../src/schema/index";

/** "--" + space → em dash, reaching back over the two hyphens. */
const dashRule = (enabled = true): AutocorrectRule => ({
  triggers: (text) => text === " ",
  enabled: () => enabled,
  match(state, from) {
    const before = state.doc.textBetween(Math.max(0, from - 2), from);
    if (before !== "--") return null;
    return { replaceFrom: from - 2, insert: "— ", revertTo: "-- " };
  },
});

function mount(text: string, rules: AutocorrectRule[], decorators = []) {
  const key = new PluginKey<AutocorrectState>("test-autocorrect");
  const para = schema.nodes["paragraph"]!.create(null, text ? schema.text(text) : Fragment.empty);
  const doc = schema.nodes["doc"]!.create(null, Fragment.from(para));
  let state = EditorState.create({ schema, doc, plugins: [makeAutocorrectPlugin(key, rules, decorators)] });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + text.length)));
  const view = new EditorView(document.createElement("div"), { state });
  const type = (t: string) => {
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (f) => f(view, from, to, t, () => view.state.tr));
    if (!handled) view.dispatch(view.state.tr.insertText(t, from, to));
    return !!handled;
  };
  const key_ = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    !!view.someProp("handleKeyDown", (f) => f(view, new KeyboardEvent("keydown", { key: k, ...mods })));
  const text_ = () => view.state.doc.textContent;
  return { view, key, type, press: key_, text: text_ };
}

describe("WORD_COMMIT_DELIMITER", () => {
  it("matches single commit characters only", () => {
    for (const c of [" ", ".", ",", ";", ":", "!", "?"]) expect(WORD_COMMIT_DELIMITER.test(c)).toBe(true);
    for (const c of ["a", "'", '"', "  "]) expect(WORD_COMMIT_DELIMITER.test(c)).toBe(false);
  });
});

describe("marksAreUniform", () => {
  const para = (...nodes: ReturnType<typeof schema.text>[]) =>
    schema.nodes["doc"]!.create(null, schema.nodes["paragraph"]!.create(null, nodes));
  const bold = (): Mark => schema.marks["bold"]!.create();
  const italic = (): Mark => schema.marks["italic"]!.create();

  it("is true for a single run or matching runs", () => {
    expect(marksAreUniform(para(schema.text("abc")), 1, 4)).toBe(true);
    const d = para(schema.text("ab", [bold()]), schema.text("cd", [bold(), italic()]));
    expect(marksAreUniform(d, 1, 3)).toBe(true);
  });

  it("is false for runs with differing marks", () => {
    const d = para(schema.text("ab", [bold()]), schema.text("cd"));
    expect(marksAreUniform(d, 1, 5)).toBe(false);
    const d2 = para(schema.text("ab", [bold()]), schema.text("cd", [italic()]));
    expect(marksAreUniform(d2, 1, 5)).toBe(false);
  });
});

describe("makeAutocorrectPlugin", () => {
  it("converts on a trigger and reverts with one Backspace", () => {
    const t = mount("a--", [dashRule()]);
    expect(t.type(" ")).toBe(true);
    expect(t.text()).toBe("a— ");
    expect(t.key.getState(t.view.state)?.undo).toMatchObject({ inserted: "— ", revertTo: "-- " });

    expect(t.press("Backspace")).toBe(true);
    expect(t.text()).toBe("a-- ");
    expect(t.view.state.selection.from).toBe(1 + "a-- ".length);
    // The window closed with the revert.
    expect(t.press("Backspace")).toBe(false);
  });

  it("does not fire for non-triggers, disabled rules, or non-matches", () => {
    expect(mount("a--", [dashRule()]).type("x")).toBe(false);
    expect(mount("a--", [dashRule(false)]).type(" ")).toBe(false);
    expect(mount("a-", [dashRule()]).type(" ")).toBe(false);
  });

  it("applies decorators to the insert only", () => {
    const upper = (_s: unknown, m: { insert: string; replaceFrom: number; revertTo: string }) => ({
      ...m,
      insert: m.insert.toUpperCase() + "!",
    });
    const t = mount("--", [dashRule()], [upper] as never);
    t.type(" ");
    expect(t.text()).toBe("— !");
    t.press("Backspace");
    expect(t.text()).toBe("-- ");
  });

  it("ignores modified Backspace and non-Backspace keys", () => {
    const t = mount("--", [dashRule()]);
    t.type(" ");
    expect(t.press("Delete")).toBe(false);
    expect(t.press("Backspace", { ctrlKey: true })).toBe(false);
    expect(t.press("Backspace", { shiftKey: true })).toBe(false);
    expect(t.text()).toBe("— ");
  });

  it("closes the window when the caret moves or content changes", () => {
    const t = mount("--", [dashRule()]);
    t.type(" ");
    // A meta-only transaction keeps the window open.
    t.view.dispatch(t.view.state.tr.setMeta("other", 1));
    expect(t.key.getState(t.view.state)?.undo).not.toBeNull();
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, 1)));
    expect(t.key.getState(t.view.state)?.undo).toBeNull();
    expect(t.press("Backspace")).toBe(false);
  });
});
