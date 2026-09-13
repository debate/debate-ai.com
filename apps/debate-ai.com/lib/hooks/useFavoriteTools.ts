"use client"

/**
 * @fileoverview Shared favorite/pinned-tools state — TODO.md idea #17
 * ("User Settings — account-linked debate preferences"), "integrate tools
 * into user settings" follow-up. Local-first (works fully signed out, like
 * `theme-dropdown.tsx`'s `useThemeState`), best-effort synced to the
 * account via the same `/api/settings` `favoriteTools` field
 * `UserSettingsPanel`'s other fields use.
 *
 * Every consumer on a page — the star toggle on each `/tools` card
 * (`FavoriteToolButton`), every chip in the favorites strip
 * (`FavoritesController`'s markup), and the "Favorite tools" list on
 * `/settings` (`components/settings/FavoriteToolsSettings.tsx`) — mounts
 * this hook independently rather than sharing one lifted instance (`/tools`
 * alone renders one instance per tool, ~50+ on a page load). A change in
 * one instance writes `localStorage` and dispatches a same-tab
 * `favorite-tools-changed` window event so every other mounted instance
 * re-reads it and stays in sync, the same trick `ToolsSearch`'s DOM-based
 * filtering already relies on for cross-component state without a shared
 * store. The one-time account fetch on mount is deduped across all of
 * those instances via a module-level `remoteLoadPromise` — with a naive
 * per-instance `fetchUserSettings()` call, `/tools` fired ~50 GET
 * `/api/settings` requests on every load; every instance now awaits the
 * same in-flight promise, so exactly one GET fires per page load
 * regardless of how many components mount this hook.
 *
 * `toggleFavorite`/`removeFavorite` sync a single `addFavoriteTool`/
 * `removeFavoriteTool` op, and `pruneUnknown` syncs a batch
 * `removeFavoriteTools` op, rather than any of them ever PUTting a whole-list
 * `favoriteTools` replace (`saveFavoriteToolOp`) — so two tabs editing
 * favorites at once both land instead of the second PUT silently dropping
 * the first tab's change. See `state/favoriteTools.ts#applyFavoriteToolOp`'s
 * docstring.
 *
 * @module lib/hooks/useFavoriteTools
 */

import { useCallback, useEffect, useState } from "react"
import {
  fetchUserSettings,
  saveFavoriteToolOp,
  filterKnownFavoriteTools,
  isValidToolHref,
  MAX_FAVORITE_TOOLS,
} from "debate-round"

const STORAGE_KEY = "favorite-tools"
const CHANGE_EVENT = "favorite-tools-changed"

function readLocal(): string[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidToolHref) : []
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
// than each firing its own GET /api/settings on mount.
let remoteAvailable = false
let remoteLoadPromise: Promise<void> | null = null

function ensureRemoteLoaded(): Promise<void> {
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetchUserSettings()
      .then((remote) => {
        if (!remote) return
        remoteAvailable = true
        if (Array.isArray(remote.favoriteTools)) {
          writeLocal(remote.favoriteTools)
          window.dispatchEvent(new Event(CHANGE_EVENT))
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local favorites already set above rather than blocking. Left as
        // a resolved (not rejected) promise so a later mount doesn't retry
        // within the same page load; a full reload tries again.
      })
  }
  return remoteLoadPromise
}

export function useFavoriteTools() {
  const [favorites, setFavorites] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFavorites(readLocal())
    setLoaded(true)

    ensureRemoteLoaded().then(() => setFavorites(readLocal()))

    const onExternalChange = () => setFavorites(readLocal())
    window.addEventListener(CHANGE_EVENT, onExternalChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternalChange)
    }
  }, [])

  // Applies a change to local state/storage; the two sync helpers below
  // decide *how* that change reaches the account.
  const persistLocal = useCallback((next: string[]) => {
    setFavorites(next)
    writeLocal(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const syncOp = useCallback(
    (op: { addFavoriteTool?: string; removeFavoriteTool?: string; removeFavoriteTools?: string[] }) => {
      if (!remoteAvailable) return
      saveFavoriteToolOp(op).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useThemeState's/UserSettingsPanel's "local apply is never
        // blocked by a sync failure" convention.
      })
    },
    [],
  )

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites])

  const toggleFavorite = useCallback(
    (href: string) => {
      if (!isValidToolHref(href)) return
      if (favorites.includes(href)) {
        persistLocal(favorites.filter((h) => h !== href))
        syncOp({ removeFavoriteTool: href })
      } else if (favorites.length < MAX_FAVORITE_TOOLS) {
        persistLocal([...favorites, href])
        syncOp({ addFavoriteTool: href })
      }
    },
    [favorites, persistLocal, syncOp],
  )

  const removeFavorite = useCallback(
    (href: string) => {
      persistLocal(favorites.filter((h) => h !== href))
      syncOp({ removeFavoriteTool: href })
    },
    [favorites, persistLocal, syncOp],
  )

  // A favorite whose tool was since renamed/removed from the catalog would
  // otherwise sit inertly in the saved list forever, since nothing ever
  // removes it (`FavoriteToolsSettings`/the favorites strip both just skip
  // rendering it — see `state/favoriteTools.ts`'s header comment). The one
  // consumer that knows the real catalog (`FavoriteToolsSettings`) calls
  // this once loaded to prune and best-effort sync the cleanup, the same
  // way any other favorites change persists. Synced as a batch
  // `removeFavoriteTools` op — resolved server-side against the account's
  // *current* list — rather than a whole-list `favoriteTools` replace of
  // this browser's own (possibly already-stale) copy, which used to be able
  // to silently drop a star another tab had just added before this prune's
  // PUT landed.
  const pruneUnknown = useCallback(
    (validHrefs: readonly string[]) => {
      const next = filterKnownFavoriteTools(favorites, validHrefs)
      if (next === favorites) return
      const stale = favorites.filter((href) => !next.includes(href))
      persistLocal(next)
      syncOp({ removeFavoriteTools: stale })
    },
    [favorites, persistLocal, syncOp],
  )

  return { favorites, loaded, isFavorite, toggleFavorite, removeFavorite, pruneUnknown }
}
