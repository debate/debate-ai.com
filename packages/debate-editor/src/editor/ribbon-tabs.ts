/**
 * Word-style ribbon tabs — the single taxonomy behind CardMirror's tabbed
 * ribbon.
 *
 * The ribbon used to be one unbroken strip of every panel at once (undo /
 * file / speech / quick cards / structural styles / cite / colors / doc
 * menus / table / numbering / doc ops / view ops / comments), which meant
 * a narrow embed showed maybe a third of it and the rest was a horizontal
 * scroll away. Above it sat a SECOND control surface — a dropdown menu bar
 * (`../react/MenuBar.tsx`) whose categories re-bucketed CardMirror's ~30
 * `RIBBON_GROUPS` into browsable menus.
 *
 * Those two surfaces are now one. Every tab below is a page of the ribbon:
 * clicking it swaps which panels the strip shows, exactly like Word's
 * Home / Insert / Review / View. Two kinds of content hang off a tab, and a
 * tab can carry both:
 *
 *   - `panels` — ids of the ribbon's OWN markup (see `RIBBON_HTML` in
 *     `../react/ribbon-template.ts`). These are the real, stateful
 *     controls the engine wires by id at boot; a tab switch only shows and
 *     hides them, it never rebuilds or re-parents them, so every listener,
 *     `aria-pressed` state and color swatch survives untouched.
 *   - `groupTitles` — `RIBBON_GROUPS` titles rendered as generated command
 *     buttons (`ribbon-tabs-ui.ts`), one captioned cluster per group. This
 *     is what the menu bar's dropdowns used to show, promoted onto the
 *     ribbon itself.
 *
 * The four tabs that own `panels` — **File**, **Card**, **Format**, **View**
 * — are the four main sections the old single strip is split into; between
 * them they account for every panel in `RIBBON_HTML`. A handful of panels
 * are listed on a second, derived tab as well (the speech stack also
 * appears on Speech, the color panel on Color, the table/image panel on
 * Insert, comments on Edit), so a tab named after a command group shows
 * that group's real controls and not only generated buttons.
 *
 * A tab with neither a mounted panel nor a single available command is not
 * rendered at all — that is what keeps Flow off non-Windows hosts and the
 * Plugins tab absent until a plugin registers a command.
 *
 * Two tabs aren't `RIBBON_GROUPS` buckets and so sit outside the drift
 * guard below: Plugins is flagged `includesPluginCommands` and rendered
 * from the runtime plugin registry; Workspace is flagged `isWorkspaceLinks`
 * and lists `WORKSPACE_LINKS` — links out to the app's other tools and
 * pages, the same list the quick-card palette's `t` prefix searches.
 *
 * The drift guard at the bottom (mirroring `ribbon-groups.ts`'s own) keeps
 * this mapping exhaustive: every `RIBBON_GROUPS` title must appear in
 * exactly one tab.
 */

import { RIBBON_GROUPS } from './ribbon-groups.js';
import type { RibbonCommandId } from './ribbon-commands.js';

export interface RibbonTab {
  /** Stable id — used for `aria-controls`, the active-tab attribute and
   *  the panel-visibility bookkeeping in `ribbon-tabs-ui.ts`. */
  id: string;
  /** Tab label, as shown on the tab strip. */
  title: string;
  /** Element ids from `RIBBON_HTML` this tab shows. A panel may appear on
   *  more than one tab; it is the same element either way, shown in DOM
   *  order within whichever tab is active. */
  panels?: string[];
  /** `RIBBON_GROUPS[].title` values rendered, in this order, as generated
   *  command clusters after the tab's `panels`. */
  groupTitles?: string[];
  /** Commands this tab's `panels` already put on screen. They're dropped
   *  from the generated clusters so a tab never shows the same command
   *  twice — the Card tab's structural-style panel IS the "Structural
   *  styles" group, and re-listing it as six text buttons beside the real
   *  ones is noise. A group left with nothing to render is skipped
   *  entirely; a group only PARTLY covered (the file stack has four of the
   *  File group's ten commands) still renders the rest, which is the point
   *  of generating them at all. Listing a command another tab's panel
   *  covers is harmless — suppression is per-tab. */
  panelCommands?: RibbonCommandId[];
  /** Also render every currently registered plugin command, one captioned
   *  cluster per plugin. Plugin commands live outside `RIBBON_GROUPS`
   *  entirely, so this is the only way one reaches the ribbon (short of a
   *  custom ribbon button bound to it). */
  includesPluginCommands?: boolean;
  /** Render `WORKSPACE_LINKS` instead of any command cluster — these
   *  navigate to another app route rather than running a ribbon command. */
  isWorkspaceLinks?: boolean;
}

/** Ordered left→right along the tab strip. */
export const RIBBON_TABS: RibbonTab[] = [
  {
    id: 'file',
    title: 'File',
    panels: ['undo-redo-stack', 'file-stack', 'speech-stack'],
    groupTitles: ['File', 'Collaboration'],
    panelCommands: [
      'newDocument',
      'openFile',
      'save',
      'toggleAutosave',
      'newSpeechDocument',
      'markActiveAsSpeech',
      'sendToSpeechAtCursor',
      'sendToSpeechAtEnd',
    ],
  },
  {
    id: 'speech',
    title: 'Speech',
    panels: ['speech-stack'],
    groupTitles: ['Speech', 'Dropzone / Send and Receive Cards'],
    panelCommands: [
      'newSpeechDocument',
      'markActiveAsSpeech',
      'sendToSpeechAtCursor',
      'sendToSpeechAtEnd',
    ],
  },
  {
    id: 'card',
    title: 'Card',
    panels: ['quickcards-stack', 'formatting-panel', 'cite-panel', 'numbering-panel', 'doc-menu-panel'],
    groupTitles: ['Quick Cards', 'Structural styles', 'Numbering', 'Condense', 'Card cutter'],
    panelCommands: [
      'addQuickCard',
      'manageQuickCards',
      'openQuickCardSearch',
      'setPocket',
      'setHat',
      'setBlock',
      'setTag',
      'setAnalytic',
      'setUndertag',
      'toggleNumberRole',
      'toggleSubRole',
      'toggleNumRestart',
      'openDocToolsMenu',
      'openCardToolsMenu',
      'applyCite',
      'applyUnderline',
      'applyEmphasis',
      'clearToNormal',
    ],
  },
  {
    id: 'edit',
    title: 'Edit',
    panels: ['undo-redo-stack', 'comments-ops-panel'],
    groupTitles: ['Editing utilities', 'Find', 'Search', 'Select', 'Comments'],
    panelCommands: [
      'toggleCommentsVisible',
      'addCommentToSelection',
      'addNoteToSelection',
      'manageFlashcards',
      'createFlashcard',
      'aiAskAboutSelection',
    ],
  },
  {
    id: 'format',
    title: 'Format',
    panels: ['color-panel', 'format-menu-panel'],
    groupTitles: ['Character styles', 'Inline formatting'],
    panelCommands: [
      'applyHighlight',
      'applyShading',
      'applyFontColor',
      'openHighlightPicker',
      'openShadingPicker',
      'openFontColorPicker',
      'openFontSizePicker',
      'adjustFontSizeUp',
      'adjustFontSizeDown',
      'openTableMenu',
      'insertImage',
      'toggleSuperscript',
      'toggleSubscript',
      'toggleStrikethrough',
    ],
  },
  {
    id: 'color',
    title: 'Color',
    panels: ['color-panel'],
    groupTitles: ['Highlight tools', 'Color pickers & menus'],
    panelCommands: [
      'applyHighlight',
      'applyShading',
      'applyFontColor',
      'openHighlightPicker',
      'openShadingPicker',
      'openFontColorPicker',
      'openFontSizePicker',
      'adjustFontSizeUp',
      'adjustFontSizeDown',
    ],
  },
  {
    id: 'insert',
    title: 'Insert',
    panels: ['format-menu-panel'],
    groupTitles: ['Table'],
    panelCommands: ['openTableMenu', 'insertImage', 'toggleSuperscript', 'toggleSubscript', 'toggleStrikethrough'],
  },
  {
    id: 'ai',
    title: 'AI',
    groupTitles: ['AI'],
  },
  {
    id: 'view',
    title: 'View',
    panels: ['doc-ops-panel', 'view-ops-panel', 'comments-ops-panel'],
    groupTitles: ['View', 'Reading'],
    panelCommands: [
      'toggleParagraphIntegrity',
      'pasteAsText',
      'toggleReadMode',
      'toggleNavPane',
      'toggleCommentsVisible',
      'addCommentToSelection',
      'addNoteToSelection',
      'manageFlashcards',
      'createFlashcard',
      'aiAskAboutSelection',
    ],
  },
  {
    id: 'panes',
    title: 'Panes',
    groupTitles: ['Multi-pane workspace', 'Zoom & scale'],
  },
  {
    id: 'tools',
    title: 'Tools',
    groupTitles: ['Timer', 'Diagnostics', 'Learn', 'Cleanup', 'Voice'],
  },
  {
    id: 'flow',
    title: 'Flow',
    groupTitles: ['Flow'],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    isWorkspaceLinks: true,
  },
  {
    id: 'plugins',
    title: 'Plugins',
    includesPluginCommands: true,
  },
];

/** Panels no tab claims, so they show on every page of the ribbon. The
 *  timer panel, the doc-name chip and the shortcuts/settings/timer grid are
 *  app-level chrome; `custom-ribbon-panel` is here for a different reason —
 *  it holds the buttons the USER pinned to the ribbon (this app's Quick
 *  Access Toolbar), and burying a pinned button behind a tab is exactly
 *  what pinning it was meant to avoid. Asserted against the markup by
 *  `ribbon-tabs.test.ts`. */
export const ALWAYS_VISIBLE_PANEL_IDS = ['custom-ribbon-panel'] as const;

/** Commands whose controls live in the always-visible part of the strip
 *  (`.ribbon-right`: shortcuts, settings, the timer toggle), so no tab's
 *  generated clusters should re-list them — they are on screen already,
 *  whichever page is open. */
export const ALWAYS_VISIBLE_PANEL_COMMANDS: RibbonCommandId[] = [
  'openShortcutsReference',
  'openSettings',
  'timerToggleVisible',
];

/** The tab the ribbon opens on. Not the first one: File's contents are
 *  New / Open / Save, which every user already reaches by keyboard, while
 *  Card is the page the actual work happens on — structural styles, cite
 *  marks, numbering, quick cards. Falls back to the first populated tab if
 *  this one has nothing to show on a given host. */
export const DEFAULT_RIBBON_TAB_ID = 'card';

/** The four tabs the old single-strip ribbon is split into: between them
 *  they show every panel in `RIBBON_HTML`, so no control is reachable only
 *  from a derived tab. Asserted by `ribbon-tabs.test.ts`. */
export const MAIN_RIBBON_TAB_IDS = ['file', 'card', 'format', 'view'] as const;

/** Every panel id any tab claims — the set `ribbon-tabs-ui.ts` hides and
 *  shows. A panel NOT in here stays visible on every tab; see
 *  `ALWAYS_VISIBLE_PANEL_IDS`. */
export function ribbonTabPanelIds(): string[] {
  const seen = new Set<string>();
  for (const tab of RIBBON_TABS) for (const id of tab.panels ?? []) seen.add(id);
  return [...seen];
}

(function assertTabsCoverGroups(): void {
  const placed = new Set<string>();
  const duplicates: string[] = [];
  for (const tab of RIBBON_TABS) {
    for (const title of tab.groupTitles ?? []) {
      if (placed.has(title)) duplicates.push(title);
      placed.add(title);
    }
  }
  const allGroupTitles = RIBBON_GROUPS.map((g) => g.title);
  const missing = allGroupTitles.filter((t) => !placed.has(t));
  const extra = [...placed].filter((t) => !allGroupTitles.includes(t));
  const problems: string[] = [];
  if (missing.length > 0) problems.push(`missing from RIBBON_TABS: ${missing.join(', ')}`);
  if (extra.length > 0) problems.push(`unknown ribbon-group title: ${extra.join(', ')}`);
  if (duplicates.length > 0) problems.push(`listed on multiple tabs: ${duplicates.join(', ')}`);
  if (problems.length > 0) {
    throw new Error(`ribbon-tabs / RIBBON_GROUPS mismatch:\n  - ${problems.join('\n  - ')}`);
  }
})();
