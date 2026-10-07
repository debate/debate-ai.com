/**
 * The editor's command chrome: upstream CardMirror's toolbar as ONE strip
 * (not paged into tabs, not split into sections), with the dropdown menu
 * bar's categories above it covering every command group.
 *
 * The `RIBBON_GROUPS` exhaustiveness guard is asserted at module load by
 * `menu-bar-categories.ts` itself; importing the module here exercises it.
 */

import { describe, expect, it } from "vitest";
import { MENU_BAR_CATEGORIES, isMenuBarCategoryPopulated } from "../src/react/menu-bar-categories.js";
import { RIBBON_HTML } from "../src/react/ribbon-template.js";
import { RIBBON_GROUPS } from "../src/editor/ribbon-groups.js";

function ribbon(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = RIBBON_HTML;
  return host;
}

describe("toolbar strip", () => {
  it("is one horizontally scrolling strip with no tab row", () => {
    const host = ribbon();
    expect(host.querySelector("[role='tablist']")).toBeNull();
    expect(host.querySelector("#ribbon-tabs")).toBeNull();
    const header = host.querySelector("#ribbon");
    // The header's only child is the strip; every panel lives inside it.
    expect([...(header?.children ?? [])].map((el) => el.id)).toEqual(["ribbon-strip"]);
  });

  it("keeps upstream's panels in the strip", () => {
    const strip = ribbon().querySelector("#ribbon-strip")!;
    for (const id of [
      "undo-redo-stack",
      "file-stack",
      "speech-stack",
      "quickcards-stack",
      "formatting-panel",
      "cite-panel",
      "color-panel",
      "doc-menu-panel",
      "format-menu-panel",
      "numbering-panel",
      "doc-ops-panel",
      "view-ops-panel",
    ]) {
      expect(strip.querySelector(`#${id}`), `#${id} is missing from the strip`).not.toBeNull();
    }
  });
});

describe("menu bar categories", () => {
  it("places every ribbon group in exactly one dropdown", () => {
    const placed = MENU_BAR_CATEGORIES.flatMap((c) => c.groupTitles);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(RIBBON_GROUPS.map((g) => g.title).sort());
  });

  it("gives every category a unique title and something to list", () => {
    const titles = MENU_BAR_CATEGORIES.map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const c of MENU_BAR_CATEGORIES) {
      expect(c.groupTitles.length > 0 || c.includesPluginCommands, c.title).toBeTruthy();
    }
  });

  it("shows the everyday menus and hides Plugins until a plugin registers", () => {
    const shown = MENU_BAR_CATEGORIES.filter(isMenuBarCategoryPopulated).map((c) => c.title);
    expect(shown).toEqual(expect.arrayContaining(["File", "Card", "Edit", "Format", "View"]));
    expect(shown).not.toContain("Plugins");
    expect(shown).not.toContain("Workspace");
  });
});
