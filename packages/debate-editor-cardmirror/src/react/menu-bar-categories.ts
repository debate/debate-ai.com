/**
 * Top-level menu bar categories, above the CardMirror ribbon.
 *
 * CardMirror groups its ~500 ribbon commands into ~30 thematic groups
 * (`RIBBON_GROUPS`, `../editor/ribbon-groups.js`) for the keyboard-shortcuts
 * reference and the keybindings editor. This file re-buckets those same
 * groups into a handful of app-menu-bar categories (File, Edit, Card,
 * Format, Insert, AI, View, Tools) — one dropdown per category, with each
 * source group rendered as a labeled section inside it — so the full
 * command set stays reachable from a compact top bar sized for a small
 * embedded panel, without either flattening 500 commands into one list or
 * reproducing all 30 groups as 30 separate dropdowns.
 *
 * A drift guard (module-load assertion below, mirroring `ribbon-groups.ts`'s
 * own) keeps this mapping exhaustive: every `RIBBON_GROUPS` title must
 * appear in exactly one bucket here.
 */

import { RIBBON_GROUPS } from '../editor/ribbon-groups.js';

export interface MenuBarCategory {
  title: string;
  /** `RIBBON_GROUPS[].title` values that render as labeled sections,
   *  in this order, inside this category's dropdown. */
  groupTitles: string[];
}

export const MENU_BAR_CATEGORIES: MenuBarCategory[] = [
  {
    title: 'File',
    groupTitles: ['File', 'Speech', 'Collaboration'],
  },
  {
    title: 'Edit',
    groupTitles: ['Editing utilities', 'Find', 'Search', 'Select', 'Comments'],
  },
  {
    title: 'Card',
    groupTitles: [
      'Dropzone / Send and Receive Cards',
      'Quick Cards',
      'Structural styles',
      'Numbering',
      'Condense',
      'Card cutter',
    ],
  },
  {
    title: 'Format',
    groupTitles: [
      'Character styles',
      'Inline formatting',
      'Highlight tools',
      'Color pickers & menus',
    ],
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
    groupTitles: ['View', 'Zoom & scale', 'Multi-pane workspace', 'Reading'],
  },
  {
    title: 'Tools',
    groupTitles: ['Timer', 'Diagnostics', 'Learn', 'Cleanup'],
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
