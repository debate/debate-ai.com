/**
 * Paging behavior of the tabbed ribbon: which panels a tab shows, that a
 * switch only toggles visibility (never re-parents the engine's own
 * elements), and that a tab with no panels renders its commands instead and
 * dispatches them through the injected `runRibbon` adapter.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  activateRibbonTab,
  initRibbonTabs,
  refreshRibbonTabs,
  resetRibbonTabsForTests,
  setRibbonTabsEnabled,
} from "../src/editor/ribbon-tabs-ui.js";
import { DEFAULT_RIBBON_TAB_ID } from "../src/editor/ribbon-tabs.js";
import { RIBBON_HTML } from "../src/react/ribbon-template.js";

let ran: string[] = [];
let navigated: string[] = [];

const OFF = "pmd-ribbon-panel-off";
const isOff = (id: string): boolean =>
  document.getElementById(id)?.classList.contains(OFF) ?? false;
const tabButton = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`.ribbon-tab[data-tab-id="${id}"]`)!;
const clusterTitles = (): (string | null)[] =>
  [...document.querySelectorAll("#ribbon-command-panel .ribbon-cmd-cluster-title")].map(
    (el) => el.textContent,
  );
const commandIds = (): (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>("#ribbon-command-panel .ribbon-cmd-btn")].map(
    (el) => el.dataset.commandId,
  );

beforeEach(() => {
  document.body.innerHTML = RIBBON_HTML;
  ran = [];
  navigated = [];
  resetRibbonTabsForTests();
  initRibbonTabs({
    run: (id) => ran.push(String(id)),
    navigate: (href) => navigated.push(href),
  });
});

describe("ribbon tab paging", () => {
  it("renders a tab per populated category and opens the first one", () => {
    const titles = [...document.querySelectorAll(".ribbon-tab")].map((b) => b.textContent);
    expect(titles.slice(0, 3)).toEqual(["File", "Speech", "Card"]);
    // Opens on Card, not the leftmost tab — see DEFAULT_RIBBON_TAB_ID.
    expect(document.getElementById("ribbon-strip")?.dataset.activeTab).toBe("card");
    expect(tabButton("card").getAttribute("aria-selected")).toBe("true");
    expect(tabButton("file").getAttribute("aria-selected")).toBe("false");
  });

  it("shows only the active tab's panels", () => {
    // Card: the whole card-cutting loop — quick cards, structural styles,
    // cite marks, numbering, the Doc/Card menus.
    expect(isOff("formatting-panel")).toBe(false);
    expect(isOff("cite-panel")).toBe(false);
    expect(isOff("color-panel")).toBe(true);
    expect(isOff("file-stack")).toBe(true);

    tabButton("format").click();
    expect(isOff("color-panel")).toBe(false);
    expect(isOff("format-menu-panel")).toBe(false);
    expect(isOff("formatting-panel")).toBe(true);

    tabButton("file").click();
    expect(isOff("file-stack")).toBe(false);
    expect(isOff("undo-redo-stack")).toBe(false);
    expect(isOff("color-panel")).toBe(true);
  });

  it("leaves app-level chrome on every tab", () => {
    for (const id of ["file", "card", "format", "view"]) {
      activateRibbonTab(id);
      expect(isOff("timer-panel")).toBe(false);
      expect(document.querySelector(".ribbon-right")?.classList.contains(OFF)).toBe(false);
    }
  });

  it("never re-parents a panel the engine holds a reference to", () => {
    const before = document.getElementById("color-panel");
    tabButton("format").click();
    tabButton("view").click();
    tabButton("format").click();
    expect(document.getElementById("color-panel")).toBe(before);
    expect(before?.parentElement?.classList.contains("ribbon-left")).toBe(true);
  });

  it("renders generated command buttons for a tab with no panels, and runs them", () => {
    const panel = document.getElementById("ribbon-command-panel")!;
    tabButton("tools").click();
    expect(panel.hidden).toBe(false);
    expect(clusterTitles()).toContain("Timer");

    const button = panel.querySelector<HTMLElement>(".ribbon-cmd-btn")!;
    button.click();
    expect(ran).toEqual([button.dataset.commandId]);
  });

  it("does not re-list a command its own panel already shows", () => {
    // The structural-style panel IS the "Structural styles" group, so the
    // group renders nothing and is skipped; Condense has no panel and does.
    tabButton("card").click();
    expect(clusterTitles()).not.toContain("Structural styles");
    expect(clusterTitles()).not.toContain("Quick Cards");
    expect(clusterTitles()).toContain("Condense");
    expect(commandIds()).not.toContain("setPocket");
  });

  it("still renders the part of a group its panel does not cover", () => {
    // The file stack has four of the File group's ten commands.
    tabButton("file").click();
    expect(clusterTitles()).toContain("File");
    expect(commandIds()).toContain("saveAs");
    expect(commandIds()).not.toContain("openFile");
  });

  it("never re-lists the always-visible shortcuts / settings / timer grid", () => {
    tabButton("view").click();
    expect(commandIds()).not.toContain("openSettings");
    expect(commandIds()).not.toContain("openShortcutsReference");
    expect(commandIds()).toContain("cycleTheme");
    tabButton("tools").click();
    expect(commandIds()).not.toContain("timerToggleVisible");
    expect(commandIds()).toContain("timerReset");
  });

  it("navigates rather than running a command on the Workspace tab", () => {
    tabButton("workspace").click();
    const button = document
      .getElementById("ribbon-command-panel")!
      .querySelector<HTMLElement>(".ribbon-cmd-btn")!;
    button.click();
    expect(ran).toEqual([]);
    expect(navigated).toHaveLength(1);
    expect(navigated[0]?.startsWith("/")).toBe(true);
  });

  it("rebuilds the command panel from scratch on every switch", () => {
    tabButton("tools").click();
    expect(clusterTitles()).toContain("Timer");
    tabButton("card").click();
    expect(clusterTitles()).not.toContain("Timer");
    expect(isOff("formatting-panel")).toBe(false);
  });

  it("un-pages the ribbon when tabs are disabled, and re-pages on re-enable", () => {
    setRibbonTabsEnabled(false);
    expect(document.getElementById("ribbon-tabs")?.hidden).toBe(true);
    expect(document.body.classList.contains("pmd-ribbon-tabs-off")).toBe(true);
    for (const id of ["file-stack", "color-panel", "doc-ops-panel", "quickcards-stack"]) {
      expect(isOff(id), id).toBe(false);
    }

    setRibbonTabsEnabled(true);
    expect(document.getElementById("ribbon-tabs")?.hidden).toBe(false);
    expect(document.body.classList.contains("pmd-ribbon-tabs-off")).toBe(false);
    expect(isOff("color-panel")).toBe(true);
  });

  it("moves between tabs with the arrow keys", () => {
    const file = tabButton("file");
    file.focus();
    file.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.getElementById("ribbon-strip")?.dataset.activeTab).toBe("speech");
    expect(document.activeElement).toBe(tabButton("speech"));
  });

  it("keeps the open tab across a strip rebuild", () => {
    tabButton("view").click();
    refreshRibbonTabs(true);
    expect(document.getElementById("ribbon-strip")?.dataset.activeTab).toBe("view");
    expect(tabButton("view").getAttribute("aria-selected")).toBe("true");
  });

  it("opens the default tab on a ribbon that has never been paged", () => {
    resetRibbonTabsForTests();
    document.body.innerHTML = RIBBON_HTML;
    initRibbonTabs({ run: () => {}, navigate: () => {} });
    expect(document.getElementById("ribbon-strip")?.dataset.activeTab).toBe(
      DEFAULT_RIBBON_TAB_ID,
    );
  });
});
