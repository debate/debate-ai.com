/**
 * Narrow-chrome detection — the guard that keeps a phone-width embed
 * from rendering the desktop chrome's fixed-width sidebars over the
 * whole column.
 *
 * `#app` insets from BOTH left sidebars (`left: var(--nav-width)`, or
 * `calc(var(--nav-width) + var(--pmd-recovery-width))` while the
 * crash-recovery sidebar is up — 300px and 580px). In a 360px column
 * that inset is wider than the column, so the document lands entirely
 * off the right edge and the editor reads as empty. `isNarrowChrome`
 * is what flips style.css's "Narrow chrome" block on, and what stops
 * the recovery sidebar from being the first thing a phone user meets.
 */

import { describe, expect, it, afterEach } from "vitest";
import {
  chromeBoxWidth,
  isNarrowChrome,
  NARROW_CHROME_MAX_WIDTH,
  resolveMobileLayout,
} from "../src/editor/mobile-layout.js";

/** jsdom reports 0 for every clientWidth (it does no layout), so an
 *  embed of a given width has to be faked at the property level. */
function mountEmbed(width: number): HTMLElement {
  const embed = document.createElement("div");
  embed.className = "dec-cardmirror-embed";
  Object.defineProperty(embed, "clientWidth", { value: width, configurable: true });
  document.body.appendChild(embed);
  return embed;
}

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
}

afterEach(() => {
  document.body.innerHTML = "";
  setViewport(1024);
});

describe("isNarrowChrome", () => {
  it("flags a phone-width column", () => {
    expect(isNarrowChrome(360)).toBe(true);
  });

  it("leaves a desktop-width column alone", () => {
    expect(isNarrowChrome(1440)).toBe(false);
  });

  it("treats the threshold itself as wide enough", () => {
    expect(isNarrowChrome(NARROW_CHROME_MAX_WIDTH)).toBe(false);
    expect(isNarrowChrome(NARROW_CHROME_MAX_WIDTH - 1)).toBe(true);
  });

  it("does not call an unmeasurable box narrow", () => {
    // A `display: none` ancestor, or a read before first layout,
    // reports 0 — narrowing the chrome off that would hide the
    // sidebars in a perfectly wide deployment.
    expect(isNarrowChrome(0)).toBe(false);
  });
});

describe("chromeBoxWidth", () => {
  it("measures the viewport in a page-owning deployment", () => {
    setViewport(1280);
    expect(chromeBoxWidth()).toBe(1280);
  });

  it("measures the embed's column, not the window", () => {
    // The squeeze that matters: a narrow panel on a wide desktop.
    // embed-containment.css pins the chrome to the embed, so the
    // column is the box its sidebars have to fit inside.
    setViewport(1440);
    mountEmbed(380);
    expect(chromeBoxWidth()).toBe(380);
    expect(isNarrowChrome(chromeBoxWidth())).toBe(true);
  });

  it("falls back to the viewport when the embed measures 0", () => {
    setViewport(1440);
    mountEmbed(0);
    expect(chromeBoxWidth()).toBe(1440);
  });
});

describe("narrow chrome vs. the mobile shell decision", () => {
  it("covers the phone-width embed the shell decision refuses", () => {
    // `resolveMobileLayout` returns false for every embed by design —
    // the view-first shell hardcodes viewport positioning and would
    // paint over the host page. That is exactly the case that used to
    // get no narrow handling at all.
    const embeddedPhone = {
      hostKind: "browser",
      coarsePointer: true,
      viewportWidth: 360,
      embedded: true,
    };
    expect(resolveMobileLayout("auto", embeddedPhone)).toBe(false);

    setViewport(360);
    mountEmbed(360);
    expect(isNarrowChrome(chromeBoxWidth())).toBe(true);
  });
});
