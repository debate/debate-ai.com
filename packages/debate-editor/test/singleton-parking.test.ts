import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

/**
 * Before a React host claims it, the singleton's container is parked on
 * <body>, off-screen. The engine's chrome inside it is `position: fixed`, so
 * the parked box has to be those elements' containing block — otherwise the
 * ribbon paints across the top of the host page, over its sidebar, for as
 * long as "Loading editor…" shows.
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

// A fresh profile makes boot start the UI tour and the Verbatim nudge, and
// each polls every 500 ms for up to two minutes. Whichever tick lands after
// jsdom tears down fails the run with "document is not defined"
// (`homeScreenActive` in ui-tour.ts). Mark both as seen so neither poll starts.
// Seeded before the engine is imported, since its settings read localStorage then.
localStorage.setItem(
  "pmd-settings",
  JSON.stringify({ hasSeenUiTour: true, hasSeenVerbatimNudge: true }),
);

describe("singleton container parking", () => {
  it("contains its fixed chrome while parked, and lets go once attached", async () => {
    const { attachTo, ensureBooted, getContainer } = await import("../src/react/singleton");
    await ensureBooted();
    // The seed above took: boot saw a profile that has already toured.
    const { settings } = await import("../src/editor/settings");
    expect(settings.get("hasSeenUiTour")).toBe(true);
    expect(settings.get("hasSeenVerbatimNudge")).toBe(true);
    const container = getContainer();
    expect(container.parentElement).toBe(document.body);
    expect(container.style.contain).toBe("layout paint");

    const host = document.createElement("div");
    host.className = "dec-cardmirror-embed";
    document.body.appendChild(host);
    attachTo(host);
    expect(container.parentElement).toBe(host);
    expect(container.style.contain).toBe("");

    // Boot leaves debounced engine work queued (the highlight-frequency
    // stylesheet rewrite runs 250 ms after the doc loads). Let it run while
    // jsdom is still up; otherwise it fires after teardown and fails the run
    // with "document is not defined".
    await new Promise((resolve) => setTimeout(resolve, 400));
  }, 30_000);
});
