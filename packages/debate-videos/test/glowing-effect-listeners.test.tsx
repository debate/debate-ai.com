// @vitest-environment jsdom
/**
 * @fileoverview Pins the one thing about the card glow that actually mattered
 * for performance: how many global listeners a page full of them installs.
 *
 * Every video card renders a `GlowingEffect`, and the grid pages in sixty
 * more cards each time the user reaches the bottom. The effect used to add a
 * `pointermove` listener and a `scroll` listener per instance, each running
 * `getBoundingClientRect()` — a forced layout — on every pointer event, so a
 * browsed-through library ended up measuring hundreds of elements per mouse
 * move and the page froze. One shared subscription is the fix; this test is
 * what stops a future edit from quietly going back to one per card.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { GlowingEffect } from "../src/ui/effects/glowing-effect";

/** Records how many listeners are live per event name. */
let liveListeners: Record<string, number>;
let container: HTMLDivElement;
let root: Root;

function countingTarget(target: EventTarget) {
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
    liveListeners[type] = (liveListeners[type] ?? 0) + 1;
    return add(type, listener, options);
  });
  vi.spyOn(target, "removeEventListener").mockImplementation((type, listener, options) => {
    liveListeners[type] = (liveListeners[type] ?? 0) - 1;
    return remove(type, listener, options);
  });
}

beforeEach(() => {
  liveListeners = {};
  // jsdom has no IntersectionObserver; the effect gates its per-frame work on
  // one, so give it a stand-in that reports everything as on screen.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  countingTarget(document);
  countingTarget(window);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Renders `count` enabled glows into the container. */
function renderGlows(count: number) {
  act(() => {
    root.render(
      createElement(
        "div",
        null,
        ...Array.from({ length: count }, (_, index) =>
          createElement(GlowingEffect, { key: index, disabled: false }),
        ),
      ),
    );
  });
}

describe("GlowingEffect", () => {
  it("installs one pointer and one scroll listener however many cards mount", () => {
    renderGlows(50);
    expect(liveListeners.pointermove).toBe(1);
    expect(liveListeners.scroll).toBe(1);
  });

  it("keeps that single subscription as more cards page in", () => {
    renderGlows(20);
    renderGlows(120);
    expect(liveListeners.pointermove).toBe(1);
    expect(liveListeners.scroll).toBe(1);
  });

  it("releases the shared listeners once the last card unmounts", () => {
    renderGlows(30);
    act(() => root.render(createElement("div")));
    expect(liveListeners.pointermove).toBe(0);
    expect(liveListeners.scroll).toBe(0);
  });

  it("installs nothing while disabled, which is the default", () => {
    act(() => {
      root.render(
        createElement(
          "div",
          null,
          ...Array.from({ length: 10 }, (_, index) =>
            createElement(GlowingEffect, { key: index }),
          ),
        ),
      );
    });
    expect(liveListeners.pointermove ?? 0).toBe(0);
    expect(liveListeners.scroll ?? 0).toBe(0);
  });
});
