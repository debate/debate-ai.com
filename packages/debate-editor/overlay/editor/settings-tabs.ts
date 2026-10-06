/**
 * CardMirror's settings as tabs a host page's own Settings sidebar can list.
 *
 * The editor's gear-icon modal keeps its own sidebar (`CATEGORY_TABS`, in
 * `settings-categories.ts`), but on debate-ai.com most of those categories
 * live on the site's Settings pages instead — Appearance and Accessibility
 * only there. This is the one exported list of them: the category id
 * `buildEmbeddedSettingsPanel` (in `settings-ui.ts`, or the React
 * `CardMirrorSettingsSection`) renders, the label the sidebar shows, and a
 * one-line description for the section header.
 *
 * Plain data with no imports, so a server route can read it too (the
 * account-mirror allow-list in the web app is derived from it).
 */

import type { SettingsCategory } from './settings.js';

export interface CardMirrorSettingsTab {
  /** The settings category the tab renders. */
  id: SettingsCategory;
  /** Sidebar label. */
  label: string;
  /** One line for the section header under the label. */
  description: string;
}

/** In the order a sidebar lists them. Plugins is left out: it is desktop-only
 *  (installed by the Electron main process) and would render empty on web. */
export const CARDMIRROR_SETTINGS_TABS: readonly CardMirrorSettingsTab[] = [
  { id: 'general', label: 'General', description: 'Startup, language and general editor behavior.' },
  { id: 'files', label: 'Files', description: 'Opening, saving, autosave and file handling.' },
  { id: 'appearance', label: 'Appearance', description: 'Colors, fonts, sizing and layout.' },
  { id: 'accessibility', label: 'Accessibility', description: 'Contrast, motion and readability overrides.' },
  { id: 'editing', label: 'Editing', description: 'Typing, formatting and card cutting.' },
  { id: 'shortcuts', label: 'Keyboard', description: 'View and customize keyboard shortcuts.' },
  { id: 'comments-ai', label: 'Comments & AI', description: 'Comments, AI providers and assistance.' },
  { id: 'pairing', label: 'Collaboration', description: 'Real-time collaboration and sharing.' },
];
