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
/** Elements the shared visibility observer is currently watching. */
let observed: Element[];
/** Reports an intersection change to the shared observer, from a test. */
let notifyIntersection: (targets: Element[], isIntersecting: boolean) => void;
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
  observed = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
        notifyIntersection = (targets, isIntersecting) =>
          callback(targets.map((target) => ({ target, isIntersecting })));
      }
      observe(target: Element) {
        observed.push(target);
      }
      unobserve(target: Element) {
        observed = observed.filter((element) => element !== target);
      }
      disconnect() {
        observed = [];
      }
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

  it("books no animation frame for a pointer no card can see", () => {
    // A scroll through a long grid used to queue a frame per event purely to
    // walk every card ever loaded and find that none of them were on screen.
    // The observer stub reports nothing as intersecting, so nothing is.
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    renderGlows(200);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 10, clientY: 10 }));
    window.dispatchEvent(new Event("scroll"));
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("measures only the cards on screen, not every card loaded", () => {
    // The per-frame cost has to stay proportional to what is visible: the
    // grid pages in sixty cards at a time and unmounts none of them, so a
    // pass over all of them is a pass that keeps growing for the life of the
    // page. `getBoundingClientRect` is the measurement, and it is a forced
    // layout — the expensive part.
    const measure = vi.spyOn(Element.prototype, "getBoundingClientRect");
    // Run the scheduled frame by hand: jsdom's own rAF is timer-driven, and
    // what this test is about is what happens inside that one callback.
    let frame: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });

    renderGlows(200);
    act(() => notifyIntersection(observed.slice(0, 3), true));

    measure.mockClear();
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 10, clientY: 10 }));
    expect(frame).toBeTypeOf("function");
    act(() => frame!(0));

    // Three cards on screen out of two hundred loaded, so at most three
    // forced layouts — not two hundred.
    expect(measure.mock.calls.length).toBeLessThanOrEqual(3);
    expect(measure.mock.calls.length).toBeGreaterThan(0);
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
