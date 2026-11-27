/**
 * The editor's command chrome: upstream Debate Editor's toolbar as ONE
 * scrolling strip (not paged into tabs) laid out as two balanced rows of
 * compact buttons, with the dropdown menu bar's categories above it covering
 * every command group.
 *
 * The `RIBBON_GROUPS` exhaustiveness guard is asserted at module load by
 * `menu-bar-categories.ts` itself; importing the module here exercises it.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      "numbering-panel",
      "doc-ops-panel",
      "view-ops-panel",
    ]) {
      expect(strip.querySelector(`#${id}`), `#${id} is missing from the strip`).not.toBeNull();
    }
  });

  it("leaves out the Table / image / superscript / subscript / strikethrough group", () => {
    // Removed on purpose; the commands stay reachable from the Insert and
    // Format menus in the menu bar.
    const strip = ribbon().querySelector("#ribbon-strip")!;
    for (const id of ["format-menu-panel", "table-menu-btn", "insert-image-btn", "superscript-btn", "subscript-btn", "strikethrough-btn"]) {
      expect(strip.querySelector(`#${id}`), `#${id} should not be in the strip`).toBeNull();
    }
  });
});

/** A visible control as the eye counts it: a split button (colour / font-size
 *  main + arrow) is one control, and so is the font-size field with its arrow. */
function controlCount(row: Element): number {
  const buttons = [...row.querySelectorAll<HTMLElement>("button:not([hidden])")];
  const arrows = buttons.filter((b) => b.classList.contains("ribbon-color-arrow")).length;
  return buttons.length - arrows + row.querySelectorAll("input").length;
}

describe("two-row toolbar", () => {
  const rows = () => [...ribbon().querySelectorAll<HTMLElement>("#ribbon-strip > .ribbon-rows > .ribbon-row")];

  it("stacks exactly two rows inside the one scrolling strip", () => {
    const host = ribbon();
    const strip = host.querySelector("#ribbon-strip")!;
    const stacked = strip.querySelectorAll(":scope > .ribbon-rows");
    expect(stacked).toHaveLength(1);
    expect(rows().map((r) => r.classList.contains("ribbon-row-1") || r.classList.contains("ribbon-row-2"))).toEqual([true, true]);
    expect(rows()).toHaveLength(2);
    // The timer panel and doc-name chip stay siblings of the rows, so the rows scroll as a unit.
    expect(strip.querySelector(":scope > #timer-panel")).not.toBeNull();
    expect(strip.querySelector(":scope > .ribbon-center #doc-name-chip")).not.toBeNull();
  });

  it("keeps every toolbar control, each in exactly one row", () => {
    const host = ribbon();
    const all = [...host.querySelectorAll("#ribbon button, #ribbon input")].filter((el) => el.id);
    const inRows = rows().flatMap((r) => [...r.querySelectorAll("button, input")].filter((el) => el.id));
    const outside = all.filter((el) => !el.closest(".ribbon-row") && el.closest("#timer-panel") === null);
    expect(outside.map((el) => el.id)).toEqual([]);
    expect(new Set(inRows.map((el) => el.id)).size).toBe(inRows.length);
    expect(inRows.length).toBe(all.length);
  });

  it("keeps logical groups whole: each panel's buttons share one row", () => {
    const [one, two] = rows();
    for (const id of ["undo-redo-stack", "file-stack", "speech-stack", "quickcards-stack", "formatting-panel", "cite-panel"]) {
      expect(one!.querySelector(`#${id}`), `#${id} belongs in row 1`).not.toBeNull();
    }
    for (const id of ["color-panel", "doc-menu-panel", "numbering-panel", "doc-ops-panel", "view-ops-panel", "comments-ops-panel", "custom-ribbon-panel"]) {
      expect(two!.querySelector(`#${id}`), `#${id} belongs in row 2`).not.toBeNull();
    }
    expect(two!.querySelector(".ribbon-right #timer-toggle-btn")).not.toBeNull();
  });

  it("deals the rows the same number of controls (or within one)", () => {
    // Counted with the speech stack in (multi-doc mode): 24 vs 23.
    const [one, two] = rows().map(controlCount) as [number, number];
    expect(Math.abs(one - two)).toBeLessThanOrEqual(1);
  });

  it("stays balanced in single-doc mode, where the speech stack is hidden", () => {
    // Four speech buttons drop out of row 1 (20 vs 23) but the rows still
    // render the same width — see the width-balance note in ribbon-template.ts.
    const [one, two] = rows();
    const speech = one!.querySelectorAll("#speech-stack button").length;
    expect(speech).toBe(4);
    expect(Math.abs(controlCount(one!) - speech - controlCount(two!))).toBeLessThanOrEqual(3);
  });
});

describe("compact buttons", () => {
  it("drops the 2rem shadcn sizes for 1.75rem controls", () => {
    const strip = ribbon().querySelector("#ribbon-strip")!;
    for (const b of strip.querySelectorAll<HTMLButtonElement>("button")) {
      const classes = b.className.split(/\s+/);
      expect(classes, `#${b.id}`).not.toContain("size-8");
      expect(classes, `#${b.id}`).not.toContain("h-8");
      expect(
        classes.some((c) => ["h-7", "h-full", "size-7"].includes(c)),
        `#${b.id} height`,
      ).toBe(true);
    }
  });

  it("keeps icon buttons square at the compact size", () => {
    const host = ribbon();
    for (const id of ["undo-btn", "open-btn", "qc-search-btn", "comments-add-btn", "reference-btn"]) {
      const classes = host.querySelector(`#${id}`)!.className.split(/\s+/);
      expect(classes, id).toContain("size-7");
    }
  });
});

describe("two-row toolbar stylesheet", () => {
  const css = readFileSync(resolve(import.meta.dirname, "../overlay/editor/ribbon-shadcn.css"), "utf8");
  const containment = readFileSync(resolve(import.meta.dirname, "../overlay/editor/embed-containment.css"), "utf8");

  it("sizes the ribbon for two 1.75rem rows plus the overflow scrollbar", () => {
    expect(css).toMatch(/--ribbon-height:\s*4\.5rem/);
    expect(css).toMatch(/\.ribbon-rows\s*\{[^}]*grid-auto-rows:\s*1\.75rem/);
    expect(css).toMatch(/\.ribbon-rows\s*\{[^}]*grid-template-columns:\s*max-content/);
  });

  it("keeps narrow embeds scrolling the whole strip, rows together", () => {
    expect(containment).toMatch(/\.dec-cardmirror-embed \.ribbon-strip\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).not.toMatch(/\.ribbon-row\s*\{[^}]*overflow/);
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
