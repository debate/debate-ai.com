import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { undo, undoDepth } from "prosemirror-history";
import type { EditorView } from "prosemirror-view";
import {
  claim,
  discardSavedState,
  ensureBooted,
  getEngineModule,
  release,
  SAVED_STATES_LIMIT,
  savedStateCount,
} from "../src/react/singleton";
import { docToHtml } from "../src/react/html-bridge";

/**
 * Every editor tab keeps its own undo history. Switching tabs claims the
 * singleton under another key; coming back has to restore that document's
 * own state rather than mounting it fresh, or Undo either does nothing or
 * walks back edits made in a different document.
 */

// jsdom lacks the layout observers and media queries the chrome wires at boot.
class NoopObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
document.elementFromPoint ??= () => null;

function liveView(): EditorView {
  const view = getEngineModule()?.getActiveView();
  if (!view) throw new Error("no active view");
  return view;
}

function type(text: string): void {
  const view = liveView();
  view.dispatch(view.state.tr.insertText(text, 1));
}

/** What a tab switch does: the outgoing pane releases, the incoming claims. */
async function switchTo(from: string, to: string, html: string): Promise<void> {
  release(from);
  await claim({ key: to }, html);
}

describe("undo history per editor tab", () => {
  it("keeps each document's own edits and history across tab switches", async () => {
    await ensureBooted();
    await claim({ key: "topic-1" }, "<p>first starter</p>");
    expect(undoDepth(liveView().state)).toBe(0);
    type("A ");
    expect(docToHtml(liveView().state.doc)).toContain("A first starter");

    await switchTo("topic-1", "topic-2", "<p>second starter</p>");
    expect(docToHtml(liveView().state.doc)).toContain("second starter");
    // A fresh document has nothing to undo — not the other tab's edit.
    expect(undoDepth(liveView().state)).toBe(0);
    type("B ");

    await switchTo("topic-2", "topic-1", "<p>first starter</p>");
    // Back on the first tab: its edit is still there, and Undo reverts it.
    expect(docToHtml(liveView().state.doc)).toContain("A first starter");
    expect(undoDepth(liveView().state)).toBe(1);
    // Applied off-view: jsdom can't measure the scroll an undo asks for.
    const before = liveView().state;
    let undone = before;
    expect(undo(before, (tr) => (undone = before.apply(tr)))).toBe(true);
    expect(docToHtml(undone.doc)).not.toContain("A first");

    await switchTo("topic-1", "topic-2", "<p>second starter</p>");
    expect(docToHtml(liveView().state.doc)).toContain("B second starter");
    expect(undoDepth(liveView().state)).toBe(1);
  }, 30_000);

  it("mounts fresh when the host's content changed while the tab was away", async () => {
    await ensureBooted();
    await claim({ key: "doc-x" }, "<p>original</p>");
    type("edit ");
    await switchTo("doc-x", "doc-y", "<p>other</p>");
    await switchTo("doc-y", "doc-x", "<p>replaced elsewhere</p>");
    expect(docToHtml(liveView().state.doc)).toContain("replaced elsewhere");
    expect(undoDepth(liveView().state)).toBe(0);
  }, 30_000);

  it("forgets a suspended tab's state, which then mounts fresh from the host's content", async () => {
    await ensureBooted();
    await claim({ key: "susp-a" }, "<p>alpha</p>");
    type("kept ");
    await switchTo("susp-a", "susp-b", "<p>beta</p>");
    // The live key has no saved copy to drop.
    expect(discardSavedState("susp-b")).toBe(false);
    expect(discardSavedState("susp-a")).toBe(true);
    expect(discardSavedState("susp-a")).toBe(false);
    // The host hands back its latest copy (which has the edit): a fresh mount
    // with that content and a history of its own.
    await switchTo("susp-b", "susp-a", "<p>kept alpha</p>");
    expect(docToHtml(liveView().state.doc)).toContain("kept alpha");
    expect(undoDepth(liveView().state)).toBe(0);
  }, 30_000);

  it("keeps at most SAVED_STATES_LIMIT documents' states", async () => {
    await ensureBooted();
    let previous = "cap-0";
    await claim({ key: previous }, "<p>cap 0</p>");
    for (let i = 1; i <= SAVED_STATES_LIMIT + 3; i++) {
      const key = `cap-${i}`;
      await switchTo(previous, key, `<p>cap ${i}</p>`);
      previous = key;
    }
    expect(savedStateCount()).toBeLessThanOrEqual(SAVED_STATES_LIMIT);
  }, 30_000);
});
