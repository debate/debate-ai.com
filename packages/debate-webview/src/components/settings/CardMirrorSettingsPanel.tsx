"use client"

/**
 * @fileoverview The CardMirror editor's settings — the whole of `/settings`.
 *
 * The page used to be this app's own account form (debate style, font size,
 * theme, favourite tools, tool-data sync, word-limit presets) with the
 * editor's General / Appearance / Accessibility rows as a second tab. It is
 * the editor's settings surface now: every category the editor's own
 * gear-icon modal shows, plus the Appearance and Accessibility tabs that
 * live only here (`EDITOR_SETTINGS_TABS`, in `lib/editor-preferences.ts`,
 * which is also the allow-list `app/api/settings/route.ts`'s
 * `editorPreferences` field is validated against).
 *
 * Renders `EditorSettingsPanel` directly in this component tree (it used
 * to embed `/settings/editor-panel` in a same-origin iframe), so the whole
 * panel — the editor's settings UI and its stylesheet — loads with the page.
 *
 * Its first tab is Preferences — the account's plan and upgrade links, then
 * the app's own debate style, font and theme form (`UserSettingsPanel`),
 * merged in from the old `/settings/preferences` page. The research agent's
 * sections follow the editor's tabs, merged in from the old
 * `/settings/research` pages. A `?category=` on `/settings` opens any tab
 * directly (`research-<section>` for a research one).
 *
 * @module components/settings/CardMirrorSettingsPanel
 */

import Link from "next/link"
import { ArrowLeft, Settings2 } from "lucide-react"
import { EditorSettingsPanel } from "./EditorSettingsPanel"

/**
 * Fills its parent edge to edge, with no padding: the settings sidebar runs
 * the full height on the left, with the Back link and the "Settings" title at
 * its top and the site's footer links (Docs, Privacy, …) at its bottom.
 */
export function CardMirrorSettingsPanel() {
  return (
    <div className="h-full bg-background">
      <EditorSettingsPanel
        sidebarHeader={
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Settings2 className="h-4 w-4 text-foreground" />
              <h2 className="text-base font-semibold">Settings</h2>
            </div>
            <Link
              href="/debate"
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-background hover:bg-accent text-xs font-medium text-foreground transition-colors"
              aria-label="Back to debate flow"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>
        }
      />
    </div>
  )
}
