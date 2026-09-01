"use client"

/**
 * Isolated iframe document embedding the ebb flow editor's own Settings
 * dialog (`debate-flow-ebb`'s `SettingsPanel`) on /settings.
 *
 * Standalone, that dialog is opened/closed by `useFlowStore`'s
 * `settingsOpen` flag from a gear icon inside an open flow — there is no
 * such trigger here, so this route forces it open on mount and, since the
 * dialog is otherwise closeable (an X button, Escape) with nothing behind
 * it in this context, reopens it immediately if it ever closes rather than
 * leaving a blank iframe.
 *
 * Same-origin, so the dialog's own `useFlowStore` reads/writes the ebb
 * flow editor's usual `localStorage` keys directly — no postMessage/CORS
 * dance needed, the same reason `CardMirrorSettingsRoute` talks to
 * `/api/settings` directly instead of relaying through its parent frame.
 * `.ebb-scope` is ebb's CSS root (`debate-flow-ebb/styles/ebb-scope.css`,
 * already imported by the host app's global stylesheet so its Tailwind
 * build generates ebb's utility classes): every design token ebb defines
 * resolves only under that class, so this route's own wrapper needs it too.
 */

import { useEffect } from "react"
import SettingsPanel from "debate-flow-ebb/settings-panel"
import { useFlowStore } from "debate-flow-ebb/store"
import { TooltipProvider } from "debate-flow-ebb/tooltip"

export function FlowSettingsRoute() {
  const open = useFlowStore((s) => s.settingsOpen)
  const setSettingsOpen = useFlowStore((s) => s.setSettingsOpen)

  useEffect(() => {
    setSettingsOpen(true)
  }, [setSettingsOpen])

  useEffect(() => {
    if (!open) setSettingsOpen(true)
  }, [open, setSettingsOpen])

  return (
    <div className="ebb-scope h-full w-full">
      <TooltipProvider>
        <SettingsPanel />
      </TooltipProvider>
    </div>
  )
}

export default FlowSettingsRoute
