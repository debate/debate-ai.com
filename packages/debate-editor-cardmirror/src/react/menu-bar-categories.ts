/**
 * Top-level menu bar categories, above the CardMirror ribbon.
 *
 * CardMirror groups its ~500 ribbon commands into ~30 thematic groups
 * (`RIBBON_GROUPS`, `../editor/ribbon-groups.js`) for the keyboard-shortcuts
 * reference and the keybindings editor. This file re-buckets those same
 * groups into app-menu-bar categories — one dropdown per category, with
 * each source group rendered as a labeled section inside it — so the full
 * command set stays reachable from a compact top bar, without either
 * flattening 500 commands into one list or reproducing all 30 groups as 30
 * separate dropdowns. Categories are kept deliberately small (most hold
 * one or two source groups, ~10-17 commands) rather than a handful of
 * do-everything dropdowns, so any single menu stays short enough to
 * browse without heavy scrolling — see `MenuBar.tsx`'s
 * `DropdownMenuContent` for the scroll fallback on the few that still
 * don't fit (notably Edit's 24-command "Editing utilities" group, kept as
 * one bucket since it's a single `RIBBON_GROUPS` entry).
 *
 * A drift guard (module-load assertion below, mirroring `ribbon-groups.ts`'s
 * own) keeps this mapping exhaustive: every `RIBBON_GROUPS` title must
 * appear in exactly one bucket here.
 *
 * Two categories aren't `RIBBON_GROUPS` buckets at all, and so sit outside
 * the drift guard: Plugins is flagged `includesPluginCommands` and rendered
 * from the runtime plugin registry instead (see MenuBar.tsx); Workspace is
 * flagged `isWorkspaceLinks` and lists `WORKSPACE_LINKS`
 * (`../editor/workspace-links.js`) — links out to the app's other tools and
 * pages (Coach Workspace, Evidence Library, News Stream, …), the same list
 * the quick card search palette's `t` prefix searches.
 */

import { RIBBON_GROUPS } from '../editor/ribbon-groups.js';

export interface MenuBarCategory {
  title: string;
  /** `RIBBON_GROUPS[].title` values that render as labeled sections,
   *  in this order, inside this category's dropdown. */
  groupTitles: string[];
  /** When true, this category's dropdown also lists every currently
   *  registered plugin command, one labeled section per plugin, after
   *  any `groupTitles` sections. Plugin commands live outside
   *  `RIBBON_GROUPS` entirely (the drift guard below only covers core
   *  ribbon groups), so this is the only way one reaches the menu bar —
   *  without it, a plugin command stayed reachable via the ribbon and
   *  the Ctrl/Cmd-Shift-Space palette but not from here. */
  includesPluginCommands?: boolean;
  /** When true, this category's dropdown lists `WORKSPACE_LINKS`
   *  (`../editor/workspace-links.js`) instead of any `RIBBON_GROUPS`
   *  section — links out to other app tools/pages rather than running an
   *  in-document ribbon command. Sits outside the drift guard below, same
   *  as `includesPluginCommands`. */
  isWorkspaceLinks?: boolean;
}

export const MENU_BAR_CATEGORIES: MenuBarCategory[] = [
  {
    title: 'File',
    groupTitles: ['File', 'Speech'],
  },
  {
    title: 'Collab',
    groupTitles: ['Collaboration', 'Comments'],
  },
  {
    title: 'Edit',
    groupTitles: ['Editing utilities'],
  },
  {
    title: 'Find',
    groupTitles: ['Find', 'Search', 'Select'],
  },
  {
    title: 'Card',
    groupTitles: ['Structural styles', 'Numbering', 'Condense'],
  },
  {
    title: 'Card tools',
    groupTitles: ['Dropzone / Send and Receive Cards', 'Quick Cards', 'Card cutter'],
  },
  {
    title: 'Format',
    groupTitles: ['Character styles', 'Inline formatting'],
  },
  {
    title: 'Highlight',
    groupTitles: ['Highlight tools', 'Color pickers & menus'],
  },
  {
    title: 'Insert',
    groupTitles: ['Table'],
  },
  {
    title: 'AI',
    groupTitles: ['AI'],
  },
  {
    title: 'View',
    groupTitles: ['View', 'Zoom & scale', 'Reading'],
  },
  {
    title: 'Panes',
    groupTitles: ['Multi-pane workspace'],
  },
  {
    title: 'Tools',
    groupTitles: ['Timer', 'Diagnostics', 'Voice'],
  },
  {
    title: 'Practice',
    groupTitles: ['Flow', 'Learn', 'Cleanup'],
  },
  {
    title: 'Workspace',
    groupTitles: [],
    isWorkspaceLinks: true,
  },
  {
    title: 'Plugins',
    groupTitles: [],
    includesPluginCommands: true,
  },
];

(function assertCategoriesCoverGroups(): void {
  const placed = new Set<string>();
  const duplicates: string[] = [];
  for (const category of MENU_BAR_CATEGORIES) {
    for (const title of category.groupTitles) {
      if (placed.has(title)) duplicates.push(title);
      placed.add(title);
    }
  }
  const allGroupTitles = RIBBON_GROUPS.map((g) => g.title);
  const missing = allGroupTitles.filter((t) => !placed.has(t));
  const extra = [...placed].filter((t) => !allGroupTitles.includes(t));
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`missing from MENU_BAR_CATEGORIES: ${missing.join(', ')}`);
  if (extra.length > 0) problems.push(`unknown ribbon-group title: ${extra.join(', ')}`);
  if (duplicates.length > 0) problems.push(`listed in multiple categories: ${duplicates.join(', ')}`);
  if (problems.length > 0) {
    throw new Error(`menu-bar-categories / RIBBON_GROUPS mismatch:\n  - ${problems.join('\n  - ')}`);
  }
})();
