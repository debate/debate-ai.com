/**
 * The tabbed ribbon's two invariants.
 *
 * 1. The four MAIN tabs (`MAIN_RIBBON_TAB_IDS`) between them show every
 *    panel in `RIBBON_HTML` that isn't deliberately always-on. Paging the
 *    ribbon means a panel no tab claims is unreachable, and one claimed only
 *    by a DERIVED tab (Color, Insert, …) would vanish the moment that tab
 *    went empty on a given host.
 * 2. Every panel id a tab claims actually exists in `RIBBON_HTML` — the tab
 *    definitions address the markup by id from a different file, so a
 *    rename in one is silent in the other.
 *
 * The `RIBBON_GROUPS` exhaustiveness guard is asserted at module load by
 * `ribbon-tabs.ts` itself; importing the module here exercises it.
 */

import { describe, expect, it } from "vitest";
import {
  ALWAYS_VISIBLE_PANEL_IDS,
  MAIN_RIBBON_TAB_IDS,
  RIBBON_TABS,
  ribbonTabPanelIds,
} from "../src/editor/ribbon-tabs.js";
import { RIBBON_HTML } from "../src/react/ribbon-template.js";

/** Ids of the panel-level elements the ribbon's own markup declares —
 *  everything inside `.ribbon-left` plus the two always-on sections. */
function ribbonPanelIdsInMarkup(): string[] {
  const host = document.createElement("div");
  host.innerHTML = RIBBON_HTML;
  const left = host.querySelector(".ribbon-left");
  return [...(left?.children ?? [])].map((el) => el.id).filter((id) => id.length > 0);
}

describe("ribbon tabs", () => {
  it("splits every ribbon panel across the four main tabs", () => {
    const mainTabPanels = new Set(
      RIBBON_TABS.filter((t) => (MAIN_RIBBON_TAB_IDS as readonly string[]).includes(t.id)).flatMap(
        (t) => t.panels ?? [],
      ),
    );
    const alwaysOn: readonly string[] = ALWAYS_VISIBLE_PANEL_IDS;
    const pageable = ribbonPanelIdsInMarkup().filter((id) => !alwaysOn.includes(id));
    expect([...mainTabPanels].sort()).toEqual(pageable.sort());
  });

  it("never pages a panel that is meant to be always on", () => {
    for (const id of ALWAYS_VISIBLE_PANEL_IDS) {
      expect(ribbonPanelIdsInMarkup(), `${id} is not in the markup`).toContain(id);
      expect(ribbonTabPanelIds(), `${id} is claimed by a tab`).not.toContain(id);
    }
  });

  it("has exactly four main tabs, each of which exists", () => {
    expect(MAIN_RIBBON_TAB_IDS).toHaveLength(4);
    for (const id of MAIN_RIBBON_TAB_IDS) {
      expect(RIBBON_TABS.map((t) => t.id)).toContain(id);
    }
  });

  it("only claims panel ids that the ribbon markup declares", () => {
    const declared = new Set(ribbonPanelIdsInMarkup());
    for (const id of ribbonTabPanelIds()) {
      expect(declared, `unknown panel id "${id}"`).toContain(id);
    }
  });

  it("gives every tab a unique id and something to show", () => {
    const ids = RIBBON_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of RIBBON_TABS) {
      const hasContent =
        (tab.panels?.length ?? 0) > 0 ||
        (tab.groupTitles?.length ?? 0) > 0 ||
        tab.includesPluginCommands === true ||
        tab.isWorkspaceLinks === true;
      expect(hasContent, `tab "${tab.id}" declares no content`).toBe(true);
    }
  });
});
