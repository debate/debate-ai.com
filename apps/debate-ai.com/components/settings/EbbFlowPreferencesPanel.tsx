"use client"

/**
 * @fileoverview "Ebb Flow preferences" section on `/settings` — ebb's own
 * appearance/grid/editing/keyboard (and, on desktop, collaboration/updates)
 * settings, normally only reachable via the flow editor's own full-screen
 * settings dialog (`Cmd/Ctrl+,` inside a flow). Mounted here via
 * `EmbeddedSettingsPanel` (`debate-flow-ebb/settings-panel`) — the same
 * settings UI without the dialog chrome, reading and writing the same
 * `useFlowStore`-backed localStorage settings, so a change here is picked up
 * the next time a flow is opened, and vice versa.
 *
 * Unlike CardMirror's settings (embedded via an isolated iframe — see
 * `EditorPreferencesPanel`), ebb's design tokens are already scoped under
 * `.ebb-scope` rather than declared globally, so its settings UI can mount
 * directly in this component tree without fighting the app's own styles.
 *
 * @module components/settings/EbbFlowPreferencesPanel
 */

import { Waypoints } from "lucide-react"
import { EmbeddedSettingsPanel } from "debate-flow-ebb/settings-panel"

export function EbbFlowPreferencesPanel() {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Waypoints className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Ebb Flow preferences</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Appearance, grid, editing, and keyboard-shortcut settings for the Ebb Flow editor. Saved locally, and picked
        up the next time you open a flow.
      </p>
      <div className="rounded-md border border-border bg-background overflow-hidden h-[560px]">
        <EmbeddedSettingsPanel className="h-full" />
      </div>
    </div>
  )
}
