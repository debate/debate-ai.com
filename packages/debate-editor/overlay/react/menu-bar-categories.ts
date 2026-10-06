/**
 * Menu-bar categories for `MenuBar.tsx` — the dropdown menus (File / Speech /
 * Card / Edit / Format / …) stacked above CardMirror's own toolbar.
 *
 * The toolbar itself is upstream's: one unbroken strip of every panel that
 * scrolls left↔right (`#ribbon-strip`, see `ribbon-template.ts`). It is not
 * paged into tabs or split into sections. This file is the one bucketing of
 * CardMirror's ~30 `RIBBON_GROUPS` into browsable menus, so every ribbon
 * command — including the many the strip has no button for — is reachable
 * from a labeled dropdown.
 *
 * The drift guard at the bottom (mirroring `ribbon-groups.ts`'s own) keeps
 * the mapping exhaustive: every `RIBBON_GROUPS` title appears in exactly one
 * category, so a group upstream adds can't silently go missing from the menu.
 *
 * Two categories aren't `RIBBON_GROUPS` buckets: Plugins is flagged
 * `includesPluginCommands` and lists the runtime plugin registry; Workspace
 * is flagged `isWorkspaceLinks` and lists `WORKSPACE_LINKS` — links out to
 * the app's other tools and pages, the same list the quick-card palette's
 * `t` prefix searches.
 */

import { RIBBON_GROUPS } from '../editor/ribbon-groups.js';
import { isRibbonCommandAvailable } from '../editor/ribbon-availability.js';
import { pluginCommandIds } from '../editor/plugin-registry.js';
import { WORKSPACE_LINKS } from '../editor/workspace-links.js';

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

/** Ordered left→right along the menu bar. */
export const MENU_BAR_CATEGORIES: MenuBarCategory[] = [
  { title: 'File', groupTitles: ['File', 'Collaboration'] },
  { title: 'Speech', groupTitles: ['Speech', 'Dropzone / Send and Receive Cards'] },
  { title: 'Card', groupTitles: ['Quick Cards', 'Structural styles', 'Numbering', 'Condense', 'Card cutter'] },
  { title: 'Edit', groupTitles: ['Editing utilities', 'Find', 'Navigate', 'Search', 'Select', 'Comments'] },
  { title: 'Format', groupTitles: ['Character styles', 'Inline formatting'] },
  { title: 'Color', groupTitles: ['Highlight tools', 'Color pickers & menus'] },
  { title: 'Insert', groupTitles: ['Table'] },
  { title: 'AI', groupTitles: ['AI'] },
  { title: 'View', groupTitles: ['View', 'Reading'] },
  { title: 'Panes', groupTitles: ['Multi-pane workspace', 'Zoom & scale'] },
  { title: 'Tools', groupTitles: ['Timer', 'Diagnostics', 'Learn', 'Cleanup', 'Voice'] },
  { title: 'Flow', groupTitles: ['Flow'] },
  { title: 'Workspace', groupTitles: [], isWorkspaceLinks: true },
  { title: 'Plugins', groupTitles: [], includesPluginCommands: true },
];

/** Whether a category has anything to offer on this host right now. An
 *  empty one is left off the menu bar rather than opening onto "No commands
 *  available" — Flow off Windows, AI in a Lite build, Plugins until a plugin
 *  registers a command. */
export function isMenuBarCategoryPopulated(category: MenuBarCategory): boolean {
  if (category.isWorkspaceLinks) return WORKSPACE_LINKS.length > 0;
  if (category.includesPluginCommands && pluginCommandIds().length > 0) return true;
  return category.groupTitles.some((title) =>
    (RIBBON_GROUPS.find((g) => g.title === title)?.commands ?? []).some((id) => isRibbonCommandAvailable(id)),
  );
}

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
