/**
 * @fileoverview React wiring that syncs `state/settings.ts`'s `Settings`
 * registry (today `debateStyle`/`fontSize`) with the account-backed
 * `/api/settings` route via `state/settings-client.ts`. Local-first: the
 * registry already reads/writes `localStorage` on its own (see
 * `Settings.init`/`setValue`), so this hook only layers a merge-on-mount and
 * a best-effort push-on-change on top, and never blocks the local value.
 *
 * Like every other browser-API/network hook in this repo (e.g.
 * `useMicrophoneTranscription`), this file is untested wiring — the
 * validation/fetch logic it calls into lives in `state/savedSettings.ts`/
 * `state/settings-client.ts` and is Vitest covered there instead.
 *
 * @module hooks/useAccountSettings
 */

"use client"

import { useEffect, useState } from "react"
import { settings } from "../state/settings"
import { fetchAccountSettings, pushAccountSettings } from "../state/settings-client"
import type { SettingsSyncData } from "../state/savedSettings"

export type AccountSettingsSyncStatus =
  | "loading"
  | "signed-out"
  | "synced"
  | "error"

function currentSettingsSnapshot(): SettingsSyncData {
  const snapshot: SettingsSyncData = {}
  for (const key of Object.keys(settings.data)) {
    snapshot[key] = settings.data[key].value
  }
  return snapshot
}

/**
 * Merges the account's saved settings into the local `Settings` registry on
 * mount (a remote value overwrites the current local one for any key both
 * sides know about), then best-effort pushes the full local snapshot to the
 * account on every subsequent local change. Returns the current sync status
 * so a panel can render a "synced to your account" / "sign in to sync" hint.
 */
export function useAccountSettings(): AccountSettingsSyncStatus {
  const [status, setStatus] = useState<AccountSettingsSyncStatus>("loading")

  useEffect(() => {
    let cancelled = false

    // Idempotent — safe even if a caller (e.g. `useInitialLoad`) already
    // ran it. Must happen before the account merge below so a remote value
    // (fetched async) always wins over whatever localStorage had.
    settings.init()

    fetchAccountSettings()
      .then(({ signedIn, data }) => {
        if (cancelled) return
        if (!signedIn) {
          setStatus("signed-out")
          return
        }
        if (data) {
          for (const [key, value] of Object.entries(data)) {
            const known = settings.data[key]
            if (known && typeof value === typeof known.value) {
              settings.setValue(key, value as boolean | number)
            }
          }
        }
        setStatus("synced")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== "synced") return

    const unsubscribe = settings.subscribe(["any"], () => {
      pushAccountSettings(currentSettingsSnapshot()).catch(() => {
        // Best-effort: the local value (already saved to localStorage by
        // `Settings.setValue`) stays authoritative for this session either way.
      })
    })

    return unsubscribe
  }, [status])

  return status
}
