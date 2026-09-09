/**
 * @fileoverview Pins which clicks the sidebar rows hand back to the browser.
 *
 * Every row in the tree is a link except the five section headings, which are
 * groupings and so intercept their own click to toggle instead of navigating.
 * That interception has to stop short of the clicks the *browser* handles —
 * ctrl/cmd for a new tab, shift for a new window, middle-click for a new tab —
 * or "open in a new tab" does nothing at all on those rows, which is exactly
 * what it used to do.
 */

import { describe, it, expect } from "vitest";
import { opensElsewhere } from "../src/components/category-gallery/TreeItem";

/** A click event with only the fields `opensElsewhere` reads. */
function click(overrides: Partial<Record<string, boolean | number>> = {}) {
  return {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    ...overrides,
  } as unknown as React.MouseEvent<HTMLElement>;
}

describe("opensElsewhere", () => {
  it("leaves a plain left click to the row itself", () => {
    // The heading toggles; a category link navigates this tab.
    expect(opensElsewhere(click())).toBe(false);
  });

  it.each([
    ["ctrl (new tab)", { ctrlKey: true }],
    ["cmd (new tab)", { metaKey: true }],
    ["shift (new window)", { shiftKey: true }],
    ["alt (download)", { altKey: true }],
    ["middle-click (new tab)", { button: 1 }],
  ])("hands %s back to the browser", (_label, overrides) => {
    expect(opensElsewhere(click(overrides))).toBe(true);
  });
});
