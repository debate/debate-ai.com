/**
 * Menu-bar categories for `MenuBar.tsx` — a thin projection of the ribbon's
 * own tab taxonomy (`../editor/ribbon-tabs.js`).
 *
 * This file used to own the mapping: it re-bucketed CardMirror's ~30
 * `RIBBON_GROUPS` into dropdown categories for a menu bar stacked above the
 * ribbon. The ribbon is tabbed now — those same categories ARE its tabs
 * (see `RIBBON_TABS`) — but `CardMirrorEditor` still stacks `MenuBar` above
 * it (Google-Docs-style: a text-labeled menu strip above an icon toolbar),
 * so this file keeps projecting `RIBBON_TABS` into that menu's categories
 * instead of maintaining a second, hand-written bucketing that could drift
 * from the ribbon it mirrors.
 *
 * The component is also exported from this package (`react/index.tsx`) for
 * hosts that want a compact command menu of their own somewhere else on the
 * page, so the projection below keeps that working too — fed from
 * `RIBBON_TABS`, a menu can't drift from the ribbon it mirrors, and the
 * exhaustiveness guard over `RIBBON_GROUPS` lives in one place rather than
 * two.
 *
 * `panels` — the ribbon's own markup, which only the tabbed ribbon can show
 * — has no menu-bar equivalent and is dropped here. Every command in those
 * panels is also a `RIBBON_GROUPS` command, so nothing becomes unreachable.
 */

import { RIBBON_TABS } from '../editor/ribbon-tabs.js';

export interface MenuBarCategory {
  title: string;
  /** `RIBBON_GROUPS[].title` values that render as labeled sections,
   *  in this order, inside this category's dropdown. */
  groupTitles: string[];
  /** When true, this category's dropdown also lists every currently
   *  registered plugin command, one labeled section per plugin, after
   *  any `groupTitles` sections. Plugin commands live outside
   *  `RIBBON_GROUPS` entirely, so this is the only way one reaches the
   *  menu bar. */
  includesPluginCommands?: boolean;
  /** When true, this category's dropdown lists `WORKSPACE_LINKS`
   *  (`../editor/workspace-links.js`) instead of any `RIBBON_GROUPS`
   *  section — links out to other app tools/pages rather than running an
   *  in-document ribbon command. */
  isWorkspaceLinks?: boolean;
}

export const MENU_BAR_CATEGORIES: MenuBarCategory[] = RIBBON_TABS.map((tab) => ({
  title: tab.title,
  groupTitles: tab.groupTitles ?? [],
  includesPluginCommands: tab.includesPluginCommands,
  isWorkspaceLinks: tab.isWorkspaceLinks,
}));
