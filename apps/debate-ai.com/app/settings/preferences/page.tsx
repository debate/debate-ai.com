import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { UserSettingsPanel } from "debate-round"

export const metadata: Metadata = {
  title: "Debate Preferences",
  description: "Debate style, font size and font family preferences for the flow editor",
}

/**
 * The app's own account-linked debate preferences — debate style, font size
 * and font family — kept separate from `/settings` (the CardMirror editor's
 * settings, see that page's own header comment) since these drive the flow
 * editor rather than the card editor.
 *
 * Reachable from the dock's gear-icon Settings menu's "Debate Preferences"
 * row (`components/layout/CategoryDock.tsx`), which is this page's only
 * entry point — `/settings` moved away from being this app's account form
 * without leaving a replacement surface for these three fields, see
 * `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * "What it no longer shows"/"Known gaps".
 */
export default function DebatePreferencesPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="mb-4 max-w-lg mx-auto px-4 sm:px-6">
        <Link
          href="/debate"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
          aria-label="Back to debate flow"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <UserSettingsPanel />
    </div>
  )
}
