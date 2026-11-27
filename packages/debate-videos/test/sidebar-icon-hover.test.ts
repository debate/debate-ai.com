// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  ICON_HOVER_COLORS,
  ICON_HOVER_DURATIONS,
  ICON_HOVER_EFFECTS,
  ICON_HOVER_THROTTLE_MS,
  iconHoverReady,
  pickIconHoverColor,
  pickIconHoverDuration,
  pickIconHoverEffect,
  playRandomIconAnimation,
  setSidebarIconAnimations,
  sidebarIconFor,
} from "../src/ui/layout/sidebar-icon-hover";

describe("sidebar icon hover", () => {
  it("has eight anime.js effects, and never plays one twice running", () => {
    expect(ICON_HOVER_EFFECTS.map((e) => e.name)).toEqual([
      "wiggle", "bounce", "pulse", "spin", "shake", "flip", "jelly", "tada",
    ]);
    expect(pickIconHoverEffect(null, () => 0)).toBe(ICON_HOVER_EFFECTS[0]);
    for (const previous of ICON_HOVER_EFFECTS) {
      for (const r of [0, 0.5, 0.999]) expect(pickIconHoverEffect(previous, () => r)).not.toBe(previous);
    }
  });

  it("lasts 0.5s or 1s, picked at random each hover", () => {
    expect([...ICON_HOVER_DURATIONS]).toEqual([0.5, 1]);
    expect(pickIconHoverDuration(() => 0)).toBe(0.5);
    expect(pickIconHoverDuration(() => 0.49)).toBe(0.5);
    expect(pickIconHoverDuration(() => 0.5)).toBe(1);
    expect(pickIconHoverDuration(() => 0.999)).toBe(1);
  });

  it("plays each icon at most once every 3 seconds", () => {
    expect(ICON_HOVER_THROTTLE_MS).toBe(3000);
    expect(iconHoverReady(undefined, 0)).toBe(true);
    expect(iconHoverReady(10_000, 12_999)).toBe(false);
    expect(iconHoverReady(10_000, 13_000)).toBe(true);
  });

  it("picks a random color from the palette", () => {
    expect(pickIconHoverColor(() => 0)).toBe(ICON_HOVER_COLORS[0]);
    expect(pickIconHoverColor(() => 0.999)).toBe(ICON_HOVER_COLORS[ICON_HOVER_COLORS.length - 1]);
  });

  it("finds the icon of the row under the pointer, inside the sidebar only", () => {
    const root = document.createElement("aside");
    root.innerHTML = '<a href="/x"><svg></svg><span>Card Search</span></a><div><span>no row</span></div>';
    document.body.append(root);
    const label = root.querySelector("span")!;
    expect(sidebarIconFor(label, root)?.icon).toBe(root.querySelector("svg"));
    expect(sidebarIconFor(root.querySelector("div span"), root)).toBeNull();
    const outside = document.createElement("a");
    outside.innerHTML = "<svg></svg>";
    document.body.append(outside);
    expect(sidebarIconFor(outside, root)).toBeNull();
  });
});

describe("sidebar icon animation setting", () => {
  it("is on by default and follows the Settings switch", async () => {
    const { readSidebarIconAnimations, setSidebarIconAnimations, subscribeSidebarIconAnimations } = await import(
      "../src/ui/layout/sidebar-icon-hover"
    );
    localStorage.clear();
    expect(readSidebarIconAnimations()).toBe(true);
    let changes = 0;
    const stop = subscribeSidebarIconAnimations(() => changes++);
    setSidebarIconAnimations(false);
    expect(readSidebarIconAnimations()).toBe(false);
    setSidebarIconAnimations(true);
    expect(readSidebarIconAnimations()).toBe(true);
    stop();
    expect(changes).toBe(2);
  });

  it("never picks an icon inside the app dock, even when the dock sits in the sidebar", () => {
    const root = document.createElement("aside");
    root.innerHTML =
      '<div data-no-icon-hover><a href="/videos"><svg></svg></a></div><a href="/x"><svg></svg><span>Card Search</span></a>';
    document.body.append(root);
    expect(sidebarIconFor(root.querySelector("[data-no-icon-hover] svg"), root)).toBeNull();
    expect(sidebarIconFor(root.querySelector("span"), root)).not.toBeNull();
  });

  describe("playRandomIconAnimation", () => {
    const icon = () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.color = "red";
      document.body.append(svg);
      return svg;
    };
    afterEach(() => setSidebarIconAnimations(true));

    it("tints the icon, plays an icon at most once per 3s unless forced, and keeps its own color", () => {
      const svg = icon();
      playRandomIconAnimation(svg);
      const tint = svg.style.color;
      expect(tint).not.toBe("red");
      svg.style.color = "red";
      playRandomIconAnimation(svg);
      expect(svg.style.color).toBe("red");
      playRandomIconAnimation(svg, { force: true });
      expect(svg.style.color).not.toBe("red");
    });

    it("does nothing when the reader turned the animation off", () => {
      setSidebarIconAnimations(false);
      const svg = icon();
      playRandomIconAnimation(svg, { force: true });
      expect(svg.style.color).toBe("red");
    });
  });
});
