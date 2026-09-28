import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CardMirrorSettingsPanel } from "../../components/settings/CardMirrorSettingsPanel"
import { ToolsLinkCard } from "../../components/settings/ToolsLinkCard"

/**
 * The CardMirror editor's settings, and nothing else.
 *
 * This page used to be this app's own account form — debate style, font
 * size, colour theme and light/dark, then favourite tools, tool-data sync
 * and word-limit presets — with the editor's General / Appearance /
 * Accessibility rows behind a second tab. The editor's settings are the page
 * now: its whole tab set, in `CardMirrorSettingsPanel`'s embedded panel
 * (`EDITOR_SETTINGS_TABS`, in `lib/editor-preferences.ts`, is the one list of
 * which categories that is, and the allow-list the account mirror validates
 * against).
 *
 * `SettingsToolsLink` is the one exception: a link back to `/tools`, where
 * favourite tools and account tool-data sync status live now that this page
 * doesn't show them — see that component's own doc comment.
 *
 * Ebb Flow's own settings are not here: the flow editor opens them with
 * `Cmd/Ctrl+,` inside a flow, which is where they apply.
 *
 * `ToolsLinkCard` points to `/tools` for saved-tool data and account sync
 * status, which moved there when this page was cut down to editor settings
 * only and was never linked back from here.
 */
export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 max-w-5xl mx-auto px-4 sm:px-6">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <ToolsLinkCard />
      </div>

      <CardMirrorSettingsPanel />
    </div>
  )
}
