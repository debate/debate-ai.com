"use client"

/**
 * @fileoverview "Flow editor preferences" section on `/settings` — the ebb
 * flow editor's own gear-icon Settings dialog (`debate-flow-ebb`), surfaced
 * here so a signed-in or signed-out debater's flow appearance/grid/editing/
 * keyboard preferences are reachable from account Settings, not just from
 * inside an open round's flow column.
 *
 * Embeds `/settings/flow-panel` in a same-origin iframe rather than
 * rendering `debate-flow-ebb`'s `SettingsPanel` directly in this component
 * tree — see `FlowSettingsRoute`'s own docstring for why. Unlike
 * `EditorPreferencesPanel`'s CardMirror panel, that dialog is built to fill
 * its own viewport with independently scrolling nav/content panes rather
 * than grow with its content, so this iframe gets a fixed-height frame
 * instead of the postMessage auto-sizing the CardMirror panel uses.
 *
 * @module FlowPreferencesPanel
 */

import { Waypoints } from "lucide-react"

export function FlowPreferencesPanel() {
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Waypoints className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Flow editor preferences</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Appearance, grid, editing, and keyboard settings for the flow editor. Saved to this browser.
      </p>
      <div className="rounded-md border border-border bg-background overflow-hidden">
        <iframe
          src="/settings/flow-panel"
          title="Flow editor preferences"
          style={{ width: "100%", height: "70vh", minHeight: 480, border: "none", display: "block" }}
        />
      </div>
    </div>
  )
}
