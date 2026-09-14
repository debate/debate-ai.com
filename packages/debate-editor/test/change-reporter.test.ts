/**
 * @fileoverview The embed's edit-vs-replacement discrimination.
 *
 * This is the guard behind "a loaded file went blank and then saved itself
 * empty". The web hosts persist whatever `onChange` reports, so the plugin
 * has to know which doc changes are the user's edits (persist them) and which
 * are the engine swapping its own editor state in — boot, New, Open, crash
 * recovery, a joined collaboration session — which must never be reported as
 * the host document's new content, and, when what landed is blank, must not
 * be left on screen either.
 */

import { describe, expect, it, vi } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import {
  changeReporterKey,
  createChangeReporterPlugin,
  LOAD_META,
} from "../src/react/change-reporter";
import { schema } from "../src/schema/index";

const para = (text: string) =>
  schema.nodes["paragraph"]!.createChecked(null, text ? schema.text(text) : Fragment.empty);
const doc = (...blocks: PMNode[]) =>
  schema.nodes["doc"]!.createChecked(null, Fragment.fromArray(blocks));

function mount(initial: PMNode) {
  const onEdit = vi.fn();
  const onStateReplaced = vi.fn();
  let loading = false;
  const plugin = createChangeReporterPlugin({
    isLoading: () => loading,
    onEdit,
    onStateReplaced,
  });
  const place = document.createElement("div");
  document.body.appendChild(place);
  const view = new EditorView(place, {
    state: EditorState.create({ doc: initial, schema, plugins: [plugin] }),
  });
  return {
    view,
    onEdit,
    onStateReplaced,
    plugin,
    /** Replace the whole editor state, the way the engine's `mountView` does. */
    replaceState(next: PMNode, asOurOwnLoad = false) {
      loading = asOurOwnLoad;
      view.updateState(EditorState.create({ doc: next, schema, plugins: view.state.plugins }));
      loading = false;
    },
  };
}

describe("change reporter", () => {
  it("reports a typed edit", () => {
    const { view, onEdit, onStateReplaced } = mount(doc(para("hello")));
    // Mounting is itself a state replacement — the singleton ignores the
    // first one, since it has no host document loaded yet to protect.
    expect(onStateReplaced).toHaveBeenCalledTimes(1);
    onStateReplaced.mockClear();

    view.dispatch(view.state.tr.insertText(" world", 6));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onStateReplaced).not.toHaveBeenCalled();
    view.destroy();
  });

  it("reports an edit that empties the document — deleting everything is a real edit", () => {
    const { view, onEdit } = mount(doc(para("hello")));

    view.dispatch(view.state.tr.delete(0, view.state.doc.content.size));

    expect(onEdit).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it("does not report a transaction tagged as a content load", () => {
    const { view, onEdit, onStateReplaced } = mount(doc(para("stored content")));
    onStateReplaced.mockClear();

    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc(para("newer")).content);
    tr.setMeta(changeReporterKey, LOAD_META);
    view.dispatch(tr);

    expect(view.state.doc.textContent).toBe("newer");
    expect(onEdit).not.toHaveBeenCalled();
    expect(onStateReplaced).not.toHaveBeenCalled();
    view.destroy();
  });

  it("does not report the engine replacing the editor state, and flags it instead", () => {
    // The engine's `mountView` builds a whole new EditorState (and a whole
    // new EditorView). Reported as an edit, its blank starter doc is what got
    // written to the host's storage.
    const { view, onEdit, onStateReplaced, replaceState } = mount(doc(para("a loaded file")));
    onStateReplaced.mockClear();

    replaceState(doc(para("")));

    expect(onEdit).not.toHaveBeenCalled();
    expect(onStateReplaced).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it("flags a whole new EditorView the same way — that is what mountView builds", () => {
    const { view, plugin, onEdit, onStateReplaced } = mount(doc(para("a loaded file")));
    onStateReplaced.mockClear();
    view.destroy();

    const place = document.createElement("div");
    document.body.appendChild(place);
    const remounted = new EditorView(place, {
      state: EditorState.create({ doc: doc(para("")), schema, plugins: [plugin] }),
    });

    expect(onEdit).not.toHaveBeenCalled();
    expect(onStateReplaced).toHaveBeenCalledTimes(1);
    remounted.destroy();
  });

  it("stays quiet when the singleton itself is loading a new document", () => {
    const { view, onEdit, onStateReplaced, replaceState } = mount(doc(para("doc A")));
    onStateReplaced.mockClear();

    replaceState(doc(para("doc B")), true);

    expect(onEdit).not.toHaveBeenCalled();
    expect(onStateReplaced).not.toHaveBeenCalled();
    view.destroy();
  });

  it("keeps reporting edits after the engine has rebuilt the plugin stack", () => {
    // The engine rebuilds its plugin list on its own (a collab session
    // starting, keymap settings). The reporter is re-added through the
    // host-plugins provider, and its edit counter restarts from zero — which
    // must not make the next edit look like a state replacement.
    const { view, onEdit, replaceState } = mount(doc(para("start")));

    replaceState(doc(para("start")), true);
    view.dispatch(view.state.tr.insertText("!", 6));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(view.state.doc.textContent).toBe("start!");
    view.destroy();
  });
});
