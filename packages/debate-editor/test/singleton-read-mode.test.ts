import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { claim, ensureBooted, getEngineModule } from "../src/react/singleton";
import { readModePlugin } from "../src/editor/read-mode-plugin";
import { settings } from "../src/editor/settings";

/**
 * Switching speech docs claims the singleton under a new key, which mounts
 * a fresh `EditorState` — and the read-mode plugin always inits OFF. The
 * ribbon's Read mode button stayed lit while the new doc showed every word,
 * so a claim has to carry read mode over to the newly mounted doc.
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
// ProseMirror's posAtCoords (the heading breadcrumb bar) hit-tests with it.
document.elementFromPoint ??= () => null;

function readModeState() {
  const view = getEngineModule()?.getActiveView();
  if (!view) throw new Error("no active view");
  return readModePlugin.getState(view.state);
}

describe("read mode across speech-doc switches", () => {
  it("applies read mode to every newly opened document", async () => {
    await ensureBooted();
    await claim({ key: "speech-doc-a" }, "<p>first speech doc</p>");
    settings.set("readMode", true);
    expect(readModeState()?.on).toBe(true);

    await claim({ key: "speech-doc-b" }, "<p>second speech doc</p>");
    expect(readModeState()?.on).toBe(true);
    // Unhighlighted body text is hidden — the decorations were rebuilt
    // for the new doc, not just the flag.
    expect(readModeState()?.decorations.find().length).toBeGreaterThan(0);

    await claim({ key: "speech-doc-a" }, "<p>first speech doc</p>");
    expect(readModeState()?.on).toBe(true);
  }, 30_000);

  it("leaves read mode off when it is off", async () => {
    await ensureBooted();
    settings.set("readMode", false);
    await claim({ key: "speech-doc-c" }, "<p>third speech doc</p>");
    expect(readModeState()?.on).toBe(false);
  }, 30_000);
});
