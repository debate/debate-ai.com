import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { attachTo, ensureBooted, getContainer } from "../src/react/singleton";

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

describe("singleton container parking", () => {
  it("contains its fixed chrome while parked, and lets go once attached", async () => {
    await ensureBooted();
    const container = getContainer();
    expect(container.parentElement).toBe(document.body);
    expect(container.style.contain).toBe("layout paint");

    const host = document.createElement("div");
    host.className = "dec-cardmirror-embed";
    document.body.appendChild(host);
    attachTo(host);
    expect(container.parentElement).toBe(host);
    expect(container.style.contain).toBe("");
  }, 30_000);
});
