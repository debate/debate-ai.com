import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { RIBBON_HTML } from "../src/react/ribbon-template";

/**
 * Boots the real engine inside the embed's markup, the way `react/singleton.ts`
 * does: `RIBBON_HTML` in a `.dec-cardmirror-root`, then a dynamic import of
 * `editor/index.ts`, whose module-scope code looks elements up by id and binds
 * them. An upstream sync that adds a required element the template lacks (the
 * 1.13 `#file-drag-mark`, bound with no null check) throws right here instead
 * of blanking every embedded editor on the site.
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

// Record which elements get a pointer/click listener while the engine boots,
// so the test can check every toolbar button is actually wired.
const wired = new WeakSet<EventTarget>();
const originalAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
  if (type === "click" || type === "mousedown" || type === "pointerdown") wired.add(this);
  return (originalAdd as (...args: unknown[]) => void).call(this, type, ...rest);
} as typeof EventTarget.prototype.addEventListener;

/** A button counts as wired when it, or a panel it sits in below the strip
 *  itself, has a click/press listener (some panels delegate to a parent). */
function isWired(button: HTMLElement): boolean {
  for (let el: HTMLElement | null = button; el && el.id !== "ribbon-strip"; el = el.parentElement) {
    if (wired.has(el)) return true;
  }
  return false;
}

describe("engine boot inside the embed markup", () => {
  it("mounts an editor view with the single-strip toolbar wired", async () => {
    const root = document.createElement("div");
    root.className = "dec-cardmirror-root";
    root.innerHTML = RIBBON_HTML;
    document.body.appendChild(root);

    const engine = await import("../src/editor/index");
    const start = Date.now();
    while (!engine.getActiveView() && Date.now() - start < 20_000) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const view = engine.getActiveView();
    expect(view).not.toBeNull();
    expect(root.contains(view!.dom)).toBe(true);
    // The toolbar stays one strip: nothing at boot pages it into tabs.
    expect(root.querySelector("[role='tablist']")).toBeNull();
    // Every button on the strip is bound to something.
    const buttons = [...root.querySelectorAll<HTMLElement>("#ribbon-strip button")];
    expect(buttons.length).toBeGreaterThan(40);
    const unwired = buttons
      .filter((b) => !isWired(b))
      .map((b) => b.id || b.getAttribute("aria-label") || b.textContent?.trim());
    expect(unwired).toEqual([]);

    // The dropzone shelf finishes loading (IndexedDB plus a peer-tab probe)
    // after the view mounts, then renders into the DOM. Wait for that render
    // so it can't land after jsdom is torn down and fail the run with
    // "document is not defined".
    const shelfStart = Date.now();
    while (!document.querySelector(".pmd-dropzone-list li") && Date.now() - shelfStart < 10_000) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    expect(document.querySelector(".pmd-dropzone-list li")).not.toBeNull();
  }, 30_000);
});
