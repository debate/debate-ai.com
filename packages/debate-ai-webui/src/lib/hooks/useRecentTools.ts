"use client"

/**
 * @fileoverview Tracks the last few tools opened via the app-wide command
 * palette (`GlobalCommandPalette.tsx`), most-recent-first. Local-first (works
 * fully signed out), best-effort synced to the account via the same
 * `/api/settings` row `useFavoriteTools` uses — see `lib/recentTools.ts`'s
 * header for why that field's own validation/serialization stays in this
 * app rather than moving into `debate-round`.
 *
 * Mirrors `useFavoriteTools.ts`'s cross-instance sync trick (a change writes
 * `localStorage` and dispatches a same-tab `recent-tools-changed` window
 * event so every other mounted instance re-reads it) and its module-level
 * `remoteLoadPromise` dedup (one `GET /api/settings` per page load
 * regardless of how many components mount this hook), including the
 * "signed in but the load/save failed" best-effort fallback.
 *
 * @module lib/hooks/useRecentTools
 */

import { useCallback, useEffect, useState } from "react"
import { fetchUserSettings, saveRecentToolOp, type FullUserSettingsPayload } from "debate-round"
import { parseRecentTools, pushRecentTool } from "../recentTools"

const STORAGE_KEY = "recent-tools"
const CHANGE_EVENT = "recent-tools-changed"

// `recentTools` isn't part of `debate-round`'s `FullUserSettingsPayload` —
// same reason as `newsRead`/`newsLiked` (see `useNewsStreamSync.ts`): it's
// validated/serialized app-side (`lib/recentTools.ts`), not in the package.
type SettingsWithRecentTools = FullUserSettingsPayload & { recentTools: string[] }

function readLocal(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    return parseRecentTools(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function writeLocal(list: string[]) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// Module-level (not per-hook-instance) so every mounted instance shares one
// in-flight account fetch and one "is this browser signed in" flag, rather
// than each firing its own GET /api/settings on mount — mirrors
// `useFavoriteTools.ts`'s `remoteAvailable`/`remoteLoadPromise`.
let remoteAvailable = false
let remoteLoadPromise: Promise<void> | null = null

function ensureRemoteLoaded(): Promise<void> {
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetchUserSettings()
      .then((remote) => {
        if (!remote) return
        remoteAvailable = true
        const { recentTools } = remote as SettingsWithRecentTools
        if (Array.isArray(recentTools)) {
          writeLocal(recentTools)
          window.dispatchEvent(new Event(CHANGE_EVENT))
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local recents already set above rather than blocking. Left as a
        // resolved (not rejected) promise so a later mount doesn't retry
        // within the same page load; a full reload tries again.
      })
  }
  return remoteLoadPromise
}

export function useRecentTools() {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    setRecent(readLocal())

    ensureRemoteLoaded().then(() => setRecent(readLocal()))

    const onExternalChange = () => setRecent(readLocal())
    window.addEventListener(CHANGE_EVENT, onExternalChange)
    return () => window.removeEventListener(CHANGE_EVENT, onExternalChange)
  }, [])

  /** Records that `href` was just opened, promoting it to the front of the list. */
  const recordVisit = useCallback((href: string) => {
    setRecent((current) => {
      const next = pushRecentTool(current, href)
      if (next !== current) {
        writeLocal(next)
        window.dispatchEvent(new Event(CHANGE_EVENT))
        if (remoteAvailable) {
          saveRecentToolOp({ recordRecentTool: href }).catch(() => {
            // Best-effort — the change already applied locally above,
            // matching useFavoriteTools's "local apply is never blocked by
            // a sync failure" convention.
          })
        }
      }
      return next
    })
  }, [])

  return { recent, recordVisit }
}
