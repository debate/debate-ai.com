"use client"

/**
 * @fileoverview "Editor preferences" section on `/settings` — General /
 * Appearance / Accessibility, moved out of the CardMirror editor's own
 * gear-icon settings modal so they live alongside the rest of a signed-in
 * user's account preferences (see apps/debate-ai.com's
 * lib/editor-preferences.ts and app/api/settings/route.ts's
 * `editorPreferences` field).
 *
 * Embeds `/settings/editor-panel` in a same-origin iframe rather than
 * rendering CardMirror's settings UI directly in this component tree — see
 * `CardMirrorSettingsRoute`'s own docstring for why (its ~15k-line
 * stylesheet is meant for a page CardMirror fully owns, and would fight the
 * host app's own styles document-wide if imported here). The iframe
 * self-sizes to its content via a postMessage it sends on load and on
 * resize.
 *
 * @module EditorPreferencesPanel
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Settings2 } from "lucide-react"

export function EditorPreferencesPanel() {
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
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Settings2 className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Editor preferences</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        General, appearance, and accessibility settings for the card editor — colors, fonts, sizing, and
        override-anything accessibility options. Saved to your account when signed in.
      </p>
      <div className="rounded-md border border-border bg-background overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/settings/editor-panel"
          title="Editor preferences"
          style={{ width: "100%", height, border: "none", display: "block" }}
        />
      </div>
    </div>
  )
}
