/**
 * Settings dialog category metadata + deep-link target shape.
 *
 * Split out of `settings-ui.ts` so the command palette's `s`-prefix
 * search (main chunk) can list/filter categories without pulling the
 * whole Settings subtree in with it — `settings-ui.ts` is loaded
 * lazily on first open (see the dynamic imports in `index.ts` /
 * `quick-card-search-ui.ts`).
 */

import { getHost } from './host/index.js';
import { collabEnabled } from './collab/collab-gate.js';
import { isLiteBuild } from './lite.js';
import type { IconName } from './icons.js';
import type { Settings, SettingsCategory } from './settings.js';

/** Tab labels shown in the settings sidebar, in display order. */
export const CATEGORY_TABS: {
  id: SettingsCategory;
  label: string;
  icon: IconName;
  /** Desktop-only category — all its settings are `electronOnly`, so on web it
   *  would render as an empty tab. Dropped off Electron (see
   *  `visibleCategoryTabs`). */
  electronOnly?: boolean;
}[] = [
  // General's actual settings rows (Workspace / Word counts / Find / Timer)
  // moved to the app's own /settings page (see `buildEmbeddedSettingsPanel`
  // in settings-ui.ts) — the tab stays only for its non-setting diagnostic
  // sections (Benchmark, About this install, Settings backup, doc links);
  // `SettingsModal.render()` forces this tab's settings list to empty.
  { id: 'general', label: 'General', icon: 'home' },
  { id: 'files', label: 'Files', icon: 'archive' },
  // Appearance and Accessibility (colors/fonts/sizing, and the
  // override-anything accessibility panel) moved to the app's /settings page
  // in full, so they're dropped from this modal entirely rather than shown
  // empty.
  { id: 'editing', label: 'Editing', icon: 'edit' },
  { id: 'shortcuts', label: 'Keyboard', icon: 'shortcuts' },
  { id: 'comments-ai', label: 'Comments & AI', icon: 'ai' },
  // Collaboration (card sharing + co-editing) is desktop-only — the relay
  // send/receive and co-editing sessions run in the Electron main process — so
  // its settings are all electronOnly. Hide the whole tab on web rather than
  // show it empty. (Kept `id: 'pairing'` so stored settings/routes don't churn.)
  { id: 'pairing', label: 'Collaboration', icon: 'link', electronOnly: true },
  // Plugins are installed/loaded by the Electron main process, so the whole
  // tab is desktop-only (hidden on web rather than shown empty).
  { id: 'plugins', label: 'Plugins', icon: 'puzzle', electronOnly: true },
];

/** The category tabs visible on the current host — `electronOnly` categories are
 *  dropped off Electron so they don't surface as empty tabs (or empty command-
 *  palette results). */
export function visibleCategoryTabs(): { id: SettingsCategory; label: string; icon: IconName }[] {
  const hostKind = getHost().kind;
  return CATEGORY_TABS.filter((t) => {
    // Lite: no collaboration, no plugins — the tabs vanish wholesale.
    if (isLiteBuild() && (t.id === 'pairing' || t.id === 'plugins')) return false;
    if (!t.electronOnly || hostKind === 'electron') return true;
    // Web-collab: the Collaboration tab surfaces on a browser host once
    // the collab gate is open — it shows only the non-electronOnly rows
    // (account linking + self-host relay), not the card-sharing set.
    return t.id === 'pairing' && collabEnabled();
  }).map((t) =>
    // The AI rows are gone in Lite; the tab that remains is Comments.
    isLiteBuild() && t.id === 'comments-ai' ? { ...t, label: 'Comments' } : t,
  );
}

/** Deep-link target for `openSettings(target)` — jump to a tab and
 *  (optionally) scroll to one setting or a named non-setting section. */
export interface SettingsTarget {
  category?: SettingsCategory;
  settingKey?: keyof Settings;
  /** `data-anchor` value of a non-setting section to scroll to + flash. */
  anchor?: string;
}
