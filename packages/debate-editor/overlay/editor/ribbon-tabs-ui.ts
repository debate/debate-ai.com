/**
 * Tab strip controller for the ribbon (see `ribbon-tabs.ts` for the
 * taxonomy and why the ribbon is paged at all).
 *
 * Two jobs:
 *
 *  1. **Show/hide the ribbon's own panels.** A tab switch only toggles the
 *     `pmd-ribbon-panel-off` class on panels claimed by some tab — it never
 *     detaches, clones or re-parents one. That matters: `editor/index.ts`
 *     grabs those elements by id at boot and keeps live references to them
 *     (listeners, `aria-pressed` state, color swatches, the font-size
 *     input's value), so a rebuild would silently orphan half the ribbon.
 *     The class is purely additive — a panel the engine has independently
 *     marked `hidden`, or hidden by a mode rule in the stylesheet (the
 *     speech stack outside multi-doc), stays hidden on its own tab too.
 *
 *  2. **Render generated command clusters** for the tabs that carry
 *     `groupTitles` / plugin commands / workspace links. These are plain
 *     buttons dispatching through the same `runRibbon` adapter every ribbon
 *     button and keybinding uses, rebuilt on each activation so command
 *     availability (`isRibbonCommandAvailable`) and the plugin registry are
 *     always read fresh.
 *
 * `runRibbon` and the workspace navigator are injected by `index.ts` at
 * init rather than imported: `index.ts` imports THIS module, and importing
 * it back would close a cycle through ~10k lines of side-effecting boot code.
 */

import {
  ALWAYS_VISIBLE_PANEL_COMMANDS,
  DEFAULT_RIBBON_TAB_ID,
  RIBBON_TABS,
  ribbonTabPanelIds,
  type RibbonTab,
} from './ribbon-tabs.js';
import { RIBBON_GROUPS } from './ribbon-groups.js';
import { isRibbonCommandAvailable } from './ribbon-availability.js';
import { commandLabelFor, type AnyCommandId } from './ribbon-commands.js';
import { pluginCommandIds, registeredPlugins } from './plugin-registry.js';
import { WORKSPACE_LINKS } from './workspace-links.js';
import { registerRibbonTooltip, unregisterRibbonTooltip } from './ribbon-tooltips.js';
import { settings } from './settings.js';

export interface RibbonTabsHost {
  /** Dispatch a ribbon/plugin command id — `runRibbon` from `index.ts`. */
  run: (id: AnyCommandId) => void;
  /** Navigate to another app route (the Workspace tab's links). */
  navigate: (href: string) => void;
}

const PANEL_OFF_CLASS = 'pmd-ribbon-panel-off';
/** Hides the strip and un-pages the ribbon; see `setRibbonTabsEnabled`. */
const TABS_OFF_BODY_CLASS = 'pmd-ribbon-tabs-off';

let host: RibbonTabsHost | null = null;
let activeTabId: string | null = null;
let enabled = true;
/** Generated buttons currently registered with the tooltip controller —
 *  unregistered before each rebuild so the controller's target list doesn't
 *  grow a stale entry per tab switch. */
let tooltipTargets: HTMLElement[] = [];
/** Tab ids the strip is currently rendered from, so a `refreshRibbonTabs()`
 *  that would produce the same strip is a no-op. Settings changes are the
 *  refresh trigger and they fire constantly (theme, zoom, every toggle), so
 *  without this the strip would be rebuilt — and any focused tab button
 *  destroyed — on unrelated activity. */
let renderedTabIds: string | null = null;

function tabStripEl(): HTMLElement | null {
  return document.getElementById('ribbon-tabs');
}
function stripEl(): HTMLElement | null {
  return document.getElementById('ribbon-strip');
}
function commandPanelEl(): HTMLElement | null {
  return document.getElementById('ribbon-command-panel');
}

/** Commands of one `RIBBON_GROUPS` group that apply on this host right now,
 *  minus any the tab's own panels (or the always-visible right-hand grid)
 *  already put on screen — see `RibbonTab.panelCommands`. */
function availableCommandsIn(groupTitle: string, tab?: RibbonTab): AnyCommandId[] {
  const group = RIBBON_GROUPS.find((g) => g.title === groupTitle);
  const covered = new Set<AnyCommandId>([
    ...ALWAYS_VISIBLE_PANEL_COMMANDS,
    ...(tab?.panelCommands ?? []),
  ]);
  return (group?.commands ?? []).filter((id) => !covered.has(id) && isRibbonCommandAvailable(id));
}

/** Whether this tab claims a panel that is actually in the markup and not
 *  marked `hidden` — one input to "is this tab worth a place on the strip". */
function hasMountedPanel(tab: RibbonTab): boolean {
  return (tab.panels ?? []).some((id) => {
    const el = document.getElementById(id);
    return el !== null && !el.hidden;
  });
}

/** "Non-empty": the tab has something to show. Tabs that don't are left off
 *  the strip entirely — Flow off Windows, Plugins before a plugin registers,
 *  AI in a Lite build. */
export function isRibbonTabPopulated(tab: RibbonTab): boolean {
  if (hasMountedPanel(tab)) return true;
  if (tab.isWorkspaceLinks) return WORKSPACE_LINKS.length > 0;
  if (tab.includesPluginCommands && pluginCommandIds().length > 0) return true;
  return (tab.groupTitles ?? []).some((title) => availableCommandsIn(title, tab).length > 0);
}

export function populatedRibbonTabs(): RibbonTab[] {
  return RIBBON_TABS.filter(isRibbonTabPopulated);
}

// ─── Panel visibility ──────────────────────────────────────────────

function applyPanelVisibility(): void {
  const tab = RIBBON_TABS.find((t) => t.id === activeTabId);
  const shown = new Set(enabled ? (tab?.panels ?? []) : ribbonTabPanelIds());
  for (const id of ribbonTabPanelIds()) {
    document.getElementById(id)?.classList.toggle(PANEL_OFF_CLASS, !shown.has(id));
  }
}

// ─── Generated command clusters ────────────────────────────────────

function clearCommandPanel(panel: HTMLElement): void {
  for (const el of tooltipTargets) unregisterRibbonTooltip(el);
  tooltipTargets = [];
  panel.replaceChildren();
}

function makeCluster(title: string): { cluster: HTMLElement; buttons: HTMLElement } {
  const cluster = document.createElement('div');
  cluster.className = 'ribbon-cmd-cluster';
  const buttons = document.createElement('div');
  buttons.className = 'ribbon-cmd-cluster-buttons';
  const caption = document.createElement('div');
  caption.className = 'ribbon-cmd-cluster-title';
  caption.textContent = title;
  cluster.append(buttons, caption);
  return { cluster, buttons };
}

function makeCommandButton(id: AnyCommandId, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ribbon-cmd-btn';
  btn.textContent = label;
  btn.dataset.commandId = String(id);
  btn.addEventListener('click', () => host?.run(id));
  registerRibbonTooltip({ el: btn, commandId: id, label, kind: 'button' });
  tooltipTargets.push(btn);
  return btn;
}

function renderCommandPanel(): void {
  const panel = commandPanelEl();
  if (!panel) return;
  clearCommandPanel(panel);
  const tab = enabled ? RIBBON_TABS.find((t) => t.id === activeTabId) : undefined;
  if (!tab) {
    panel.hidden = true;
    return;
  }

  const clusters: HTMLElement[] = [];

  for (const title of tab.groupTitles ?? []) {
    const ids = availableCommandsIn(title, tab);
    if (ids.length === 0) continue;
    const { cluster, buttons } = makeCluster(title);
    for (const id of ids) buttons.appendChild(makeCommandButton(id, commandLabelFor(id)));
    clusters.push(cluster);
  }

  if (tab.includesPluginCommands) {
    for (const plugin of registeredPlugins()) {
      const ids = pluginCommandIds().filter((id) => id.startsWith(`${plugin.id}.`));
      if (ids.length === 0) continue;
      const { cluster, buttons } = makeCluster(plugin.name);
      for (const id of ids) buttons.appendChild(makeCommandButton(id, commandLabelFor(id)));
      clusters.push(cluster);
    }
  }

  if (tab.isWorkspaceLinks) {
    // Grouped under the same headings `/tools` uses; entries with no
    // `category` fall into a trailing "Go to" cluster.
    const sections: { category: string; links: typeof WORKSPACE_LINKS }[] = [];
    for (const link of WORKSPACE_LINKS) {
      const category = link.category ?? 'Go to';
      const last = sections[sections.length - 1];
      if (last && last.category === category) last.links.push(link);
      else sections.push({ category, links: [link] });
    }
    for (const section of sections) {
      const { cluster, buttons } = makeCluster(section.category);
      for (const link of section.links) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ribbon-cmd-btn';
        btn.textContent = link.label;
        btn.title = link.description ?? '';
        btn.addEventListener('click', () => host?.navigate(link.href));
        buttons.appendChild(btn);
      }
      clusters.push(cluster);
    }
  }

  panel.append(...clusters);
  panel.hidden = clusters.length === 0;
}

// ─── Tab strip ─────────────────────────────────────────────────────

export function activateRibbonTab(id: string): void {
  activeTabId = id;
  const strip = stripEl();
  if (strip) strip.dataset.activeTab = id;
  for (const btn of tabStripEl()?.querySelectorAll<HTMLElement>('.ribbon-tab') ?? []) {
    const selected = btn.dataset.tabId === id;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.tabIndex = selected ? 0 : -1;
  }
  applyPanelVisibility();
  renderCommandPanel();
  // A tab switch changes the strip's width wholesale; start each page at
  // its left edge rather than inheriting the previous tab's scroll offset.
  if (strip) strip.scrollLeft = 0;
}

function moveTabFocus(from: HTMLElement, delta: number | 'first' | 'last'): void {
  const tabs = [...(tabStripEl()?.querySelectorAll<HTMLElement>('.ribbon-tab') ?? [])];
  if (tabs.length === 0) return;
  const index =
    delta === 'first'
      ? 0
      : delta === 'last'
        ? tabs.length - 1
        : (tabs.indexOf(from) + delta + tabs.length) % tabs.length;
  const next = tabs[index];
  if (!next) return;
  next.focus();
  activateRibbonTab(next.dataset.tabId ?? '');
}

/** (Re)build the tab strip from the currently populated tabs. Cheap enough
 *  to run on any settings change or plugin registration — both can flip a
 *  tab between empty and populated (`cardCutterEnabled`, a plugin's first
 *  command) — because an unchanged tab list short-circuits. Pass `force` to
 *  rebuild anyway, for a change that alters a PAGE's contents without
 *  altering the strip (a second command on an already-listed plugin). */
export function refreshRibbonTabs(force = false): void {
  const strip = tabStripEl();
  if (!strip) return;
  const tabs = populatedRibbonTabs();
  const signature = `${enabled ? '1' : '0'}:${tabs.map((t) => t.id).join(',')}`;
  if (!force && signature === renderedTabIds) return;
  renderedTabIds = signature;
  strip.replaceChildren(
    ...tabs.map((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ribbon-tab';
      btn.setAttribute('role', 'tab');
      btn.dataset.tabId = tab.id;
      btn.textContent = tab.title;
      btn.setAttribute('aria-controls', 'ribbon-strip');
      btn.addEventListener('click', () => activateRibbonTab(tab.id));
      btn.addEventListener('keydown', (e: KeyboardEvent) => {
        const step =
          e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : null;
        if (step === null) return;
        e.preventDefault();
        moveTabFocus(btn, step);
      });
      return btn;
    }),
  );
  strip.hidden = !enabled || tabs.length === 0;
  // Keep the current page if it survived the rebuild; otherwise open the
  // default one, and failing that the first populated tab, so the strip is
  // never showing nothing.
  const has = (id: string | null): boolean => id !== null && tabs.some((t) => t.id === id);
  activateRibbonTab(
    has(activeTabId)
      ? activeTabId!
      : has(DEFAULT_RIBBON_TAB_ID)
        ? DEFAULT_RIBBON_TAB_ID
        : (tabs[0]?.id ?? ''),
  );
}

/** Turn paging off entirely: the strip is hidden and every panel shows at
 *  once, i.e. the pre-tabs ribbon. Hosts that embed CardMirror without a
 *  toolbar chrome of their own (`showToolbar={false}`) use this. */
export function setRibbonTabsEnabled(on: boolean): void {
  if (enabled === on) return;
  enabled = on;
  document.body.classList.toggle(TABS_OFF_BODY_CLASS, !on);
  refreshRibbonTabs(true);
}

/** Drop the module's page-lifetime state (which tab is open, what the strip
 *  was last rendered from, whether paging is on). Only tests need this: in
 *  the app the ribbon markup is created once per page load and the React
 *  singleton re-parents that same DOM, so a "fresh ribbon" never happens
 *  and the open tab is meant to survive everything else. */
export function resetRibbonTabsForTests(): void {
  host = null;
  activeTabId = null;
  renderedTabIds = null;
  enabled = true;
  tooltipTargets = [];
  document.body.classList.remove(TABS_OFF_BODY_CLASS);
}

export function initRibbonTabs(h: RibbonTabsHost): void {
  host = h;
  refreshRibbonTabs(true);
  // Availability is settings-derived (`cardCutterEnabled`, the collab gate,
  // the bulk-compress gate), so a settings change can add or remove a tab.
  settings.subscribe(() => refreshRibbonTabs());
}
