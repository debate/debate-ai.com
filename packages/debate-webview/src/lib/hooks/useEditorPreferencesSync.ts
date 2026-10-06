"use client"

/**
 * @fileoverview Account sync for the CardMirror editor's settings wherever a
 * Settings page renders them — `/settings` (`EditorSettingsPanel`), which
 * lists `CARDMIRROR_SETTINGS_TABS`.
 *
 * On mount it hydrates the editor's local settings store from the signed-in
 * account (`GET /api/settings`'s `editorPreferences`; a `401` just means
 * signed out and local values stay authoritative), then pushes the mirrored
 * keys back, debounced, whenever the store changes.
 *
 * Only keys whose rows have actually rendered are pushed (reported through
 * `noteRenderedKeys`, which `CardMirrorSettingsSection`'s `onRowsRendered`
 * feeds). A row the editor hides on this host — a desktop-only setting, one
 * revealed by another — would otherwise be pushed at its default and
 * overwrite what the account holds. `EDITOR_PREFERENCE_KEYS` then drops the
 * credentials, which never leave this browser.
 *
 * @module lib/hooks/useEditorPreferencesSync
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { EDITOR_PREFERENCE_KEYS } from "../editor-preferences"

const SAVE_DEBOUNCE_MS = 600

export function useEditorPreferencesSync(): {
  /** The local store is hydrated; render the settings rows now. */
  ready: boolean
  /** Record setting keys whose rows rendered, so they are mirrored. */
  noteRenderedKeys: (keys: string[]) => void
} {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const settingsRef = useRef<typeof import("@debate/editor/settings") | null>(null)
  const mirroredKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const settingsModule = await import("@debate/editor/settings")
      if (cancelled) return
      settingsRef.current = settingsModule
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          setSignedIn(true)
          const payload = (await res.json()) as { editorPreferences?: Record<string, unknown> }
          for (const [key, value] of Object.entries(payload.editorPreferences ?? {})) {
            settingsModule.settings.set(key as never, value as never)
          }
        }
      } catch {
        // Best-effort hydration — local defaults/localStorage stay authoritative on failure.
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !signedIn) return
    const settingsModule = settingsRef.current
    if (!settingsModule) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const push = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const editorPreferences: Record<string, unknown> = {}
        for (const key of mirroredKeysRef.current) {
          editorPreferences[key] = settingsModule.settings.get(key as never)
        }
        if (Object.keys(editorPreferences).length === 0) return
        void fetch("/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ editorPreferences }),
        }).catch(() => {
          // Best-effort — a failed account sync doesn't undo the local change.
        })
      }, SAVE_DEBOUNCE_MS)
    }
    const unsubscribe = settingsModule.settings.subscribe(push)
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [ready, signedIn])

  const noteRenderedKeys = useCallback((keys: string[]) => {
    for (const key of keys) if (EDITOR_PREFERENCE_KEYS.has(key)) mirroredKeysRef.current.add(key)
  }, [])

  return { ready, noteRenderedKeys }
}
