"use client"

/**
 * @fileoverview Account sync adapter for `NewsStreamPanel`'s optional
 * `syncRemote` prop — closes `docs/features/news-stream.md`'s "Read/like
 * state is per-browser (localStorage), not per-account" Known gap.
 * Local-first, matching `useFavoriteTools`'s convention: the panel already
 * works fully signed out against its own localStorage viewer state; this
 * hook only adds a best-effort account sync on top via the same
 * `/api/settings` row `useFavoriteTools`/`useThemeState` use.
 *
 * Unlike `useFavoriteTools`, there's no shared in-memory list to keep in
 * sync across mounted instances — `NewsStreamPanel` is rendered once per
 * page (`/news`), so this hook doesn't need `useFavoriteTools`'s
 * module-level `remoteLoadPromise` dedup trick.
 *
 * @module lib/hooks/useNewsStreamSync
 */

import { useCallback, useRef } from "react"
import { fetchUserSettings, saveUserSettings, type FullUserSettingsPayload } from "debate-round"
import type { NewsStreamSyncAdapter, NewsSyncPayload } from "debate-community"

// `FullUserSettingsPayload` (in `debate-round`) no longer carries the News
// Stream fields itself — `debate-community` (which owns `NewsSyncPayload`)
// already depends on `debate-round` for its Prep Notes/notifications
// panels, so folding `NewsSyncPayload` into `debate-round`'s own type would
// create a package cycle. The `/api/settings` row still reads/writes both
// on the same record; this hook intersects the two types locally instead.
type SettingsWithNewsSync = FullUserSettingsPayload & NewsSyncPayload

export function useNewsStreamSync(): NewsStreamSyncAdapter {
  // Whether the hydrate call found a signed-in session — pushes are skipped
  // otherwise, since a signed-out `saveUserSettings` call would only 401.
  const remoteAvailable = useRef(false)

  const hydrate = useCallback(async () => {
    try {
      const remote = (await fetchUserSettings()) as SettingsWithNewsSync | null
      if (!remote) return null
      remoteAvailable.current = true
      return { read: remote.newsRead ?? [], liked: remote.newsLiked ?? [] }
    } catch {
      // Signed in but the load failed (network/server error) — the panel
      // keeps whatever it already has locally rather than blocking.
      return null
    }
  }, [])

  const pushRead = useCallback((allReadIds: string[]) => {
    if (!remoteAvailable.current) return
    const patch: Partial<SettingsWithNewsSync> = { newsRead: allReadIds }
    saveUserSettings(patch).catch(() => {
      // Best-effort — the read/like already applied locally in the panel,
      // matching useFavoriteTools's/UserSettingsPanel's "local apply is
      // never blocked by a sync failure" convention.
    })
  }, [])

  const pushLiked = useCallback((allLikedIds: string[]) => {
    if (!remoteAvailable.current) return
    const patch: Partial<SettingsWithNewsSync> = { newsLiked: allLikedIds }
    saveUserSettings(patch).catch(() => {})
  }, [])

  return { hydrate, pushRead, pushLiked }
}
