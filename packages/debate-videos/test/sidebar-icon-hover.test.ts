// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { ICON_HOVER_EFFECTS, pickIconHoverEffect, sidebarIconFor } from "../src/ui/layout/sidebar-icon-hover";

describe("sidebar icon hover", () => {
  it("has wiggle, bounce, pulse, spin and shake, and never plays one twice running", () => {
    expect(ICON_HOVER_EFFECTS.map((e) => e.name)).toEqual(["wiggle", "bounce", "pulse", "spin", "shake"]);
    expect(pickIconHoverEffect(null, () => 0)).toBe(ICON_HOVER_EFFECTS[0]);
    for (const previous of ICON_HOVER_EFFECTS) {
      for (const r of [0, 0.5, 0.999]) expect(pickIconHoverEffect(previous, () => r)).not.toBe(previous);
    }
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
