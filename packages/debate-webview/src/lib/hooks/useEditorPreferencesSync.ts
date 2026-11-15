"use client"

/**
 * @fileoverview Account sync for the Debate Editor's settings wherever a
 * Settings page renders them — `/settings` (`EditorSettingsPanel`), which
 * lists `DEBATE_EDITOR_SETTINGS_TABS`.
 *
 * On mount it hydrates the editor's local settings store from the signed-in
 * account (`GET /api/settings`'s `editorPreferences`; a `401` just means
 * signed out and local values stay authoritative), then pushes the mirrored
 * keys back, debounced, whenever the store changes.
 *
 * Only keys whose rows have actually rendered are pushed (reported through
 * `noteRenderedKeys`, which `DebateEditorSettingsSection`'s `onRowsRendered`
 * feeds). A row the editor hides on this host — a desktop-only setting, one
 * revealed by another — would otherwise be pushed at its default and
 * overwrite what the account holds. `EDITOR_PREFERENCE_KEYS` then drops the
 * credentials, which never leave this browser.
 *
 * Of those keys, a push carries only the ones whose value differs from what
 * this tab last read from or wrote to the account (`changedEditorPreferences`
 * against a per-tab baseline). The route merges `editorPreferences` key by
 * key, so a second tab still holding an old value no longer overwrites every
 * other setting when it changes one. A key the account doesn't hold yet has
 * no baseline, so it is pushed the first time anything is. The baseline moves
 * only after a PUT succeeds, so a failed push is retried with the next one.
 *
 * @module lib/hooks/useEditorPreferencesSync
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { EDITOR_PREFERENCE_KEYS } from "../editor-preferences"

const SAVE_DEBOUNCE_MS = 600

/**
 * The entries of `current` whose value differs from `baseline` (compared as
 * JSON). A key missing from `baseline` always counts as changed.
 */
export function changedEditorPreferences(
  baseline: ReadonlyMap<string, string>,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const changed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(current)) {
    if (baseline.get(key) !== JSON.stringify(value)) changed[key] = value
  }
  return changed
}

export function useEditorPreferencesSync(): {
  /** The local store is hydrated; render the settings rows now. */
  ready: boolean
  /** Record setting keys whose rows rendered, so they are mirrored. */
  noteRenderedKeys: (keys: string[]) => void
} {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const settingsRef = useRef<typeof import("@debate-ai/editor/settings") | null>(null)
  const mirroredKeysRef = useRef<Set<string>>(new Set())
  /** Key → JSON of the value the account is known to hold, per this tab. */
  const syncedRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const settingsModule = await import("@debate-ai/editor/settings")
      if (cancelled) return
      settingsRef.current = settingsModule
      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          setSignedIn(true)
          const payload = (await res.json()) as { editorPreferences?: Record<string, unknown> }
          for (const [key, value] of Object.entries(payload.editorPreferences ?? {})) {
            settingsModule.settings.set(key as never, value as never)
            syncedRef.current.set(key, JSON.stringify(value))
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
        const current: Record<string, unknown> = {}
        for (const key of mirroredKeysRef.current) {
          current[key] = settingsModule.settings.get(key as never)
        }
        const editorPreferences = changedEditorPreferences(syncedRef.current, current)
        if (Object.keys(editorPreferences).length === 0) return
        void fetch("/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ editorPreferences }),
        })
          .then((res) => {
            if (!res.ok) return
            for (const [key, value] of Object.entries(editorPreferences)) {
              syncedRef.current.set(key, JSON.stringify(value))
            }
          })
          .catch(() => {
            // Best-effort — a failed account sync doesn't undo the local change;
            // the baseline is untouched, so the next push retries it.
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
