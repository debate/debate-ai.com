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
 * merged in from the old `/settings/preferences` page. A `?category=` on
 * `/settings` opens any tab directly.
 *
 * @module components/settings/CardMirrorSettingsPanel
 */

import { Settings2 } from "lucide-react"
import { EditorSettingsPanel } from "./EditorSettingsPanel"

export function CardMirrorSettingsPanel() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Settings2 className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Your plan, debate preferences and theme, plus every setting for the card editor — files and autosave, editing and typography, colors, fonts and sizing,
        accessibility overrides, keyboard shortcuts, comments and AI, collaboration — plus the performance benchmark
        and this install&apos;s version info. Saved to your account when signed in; API keys and relay tokens stay in
        this browser.
      </p>
      <div className="rounded-md border border-border bg-background overflow-hidden">
        <EditorSettingsPanel />
      </div>
    </div>
  )
}
