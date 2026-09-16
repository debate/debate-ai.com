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
 * Embeds `/settings/editor-panel` in a same-origin iframe rather than
 * rendering `debate-editor`'s settings UI directly in this
 * component tree — see that route's own docstring for why (its ~15k-line
 * stylesheet is meant for a page CardMirror fully owns, and would fight this
 * app's own styles document-wide if imported here). Unlike
 * ebb's flow settings — which used to sit below this panel and mounted
 * directly, ebb's design tokens being scoped under `.ebb-scope` — CardMirror's
 * are declared globally, hence the isolated iframe. The iframe self-sizes to its content via a
 * postMessage it sends on load and on resize.
 *
 * @module components/settings/CardMirrorSettingsPanel
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Settings2 } from "lucide-react"

export function CardMirrorSettingsPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(320)

  const onMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    if (event.source !== iframeRef.current?.contentWindow) return
    const data = event.data as { type?: string; height?: number } | null
    if (data?.type === "pmd-settings-panel-height" && typeof data.height === "number") {
      setHeight(Math.max(200, data.height))
    }
  }, [])

  useEffect(() => {
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onMessage])

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Settings2 className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Editor settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Every setting for the card editor — files and autosave, editing and typography, colors, fonts and sizing,
        accessibility overrides, keyboard shortcuts, comments and AI, collaboration — plus the performance benchmark
        and this install&apos;s version info. Saved to your account when signed in; API keys and relay tokens stay in
        this browser.
      </p>
      <div className="rounded-md border border-border bg-background overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/settings/editor-panel"
          title="Editor settings"
          style={{ width: "100%", height, border: "none", display: "block" }}
        />
      </div>
    </div>
  )
}
