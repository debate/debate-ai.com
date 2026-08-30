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
 * @module lib/hooks/useFavoriteTools
 */

import { useCallback, useEffect, useState } from "react"
import { fetchUserSettings, saveUserSettings, isValidToolHref, MAX_FAVORITE_TOOLS } from "debate-round"

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

  const persist = useCallback((next: string[]) => {
    setFavorites(next)
    writeLocal(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    if (remoteAvailable) {
      saveUserSettings({ favoriteTools: next }).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useThemeState's/UserSettingsPanel's "local apply is never
        // blocked by a sync failure" convention.
      })
    }
  }, [])

  const isFavorite = useCallback((href: string) => favorites.includes(href), [favorites])

  const toggleFavorite = useCallback(
    (href: string) => {
      if (!isValidToolHref(href)) return
      if (favorites.includes(href)) {
        persist(favorites.filter((h) => h !== href))
      } else if (favorites.length < MAX_FAVORITE_TOOLS) {
        persist([...favorites, href])
      }
    },
    [favorites, persist],
  )

  const removeFavorite = useCallback(
    (href: string) => {
      persist(favorites.filter((h) => h !== href))
    },
    [favorites, persist],
  )

  return { favorites, loaded, isFavorite, toggleFavorite, removeFavorite }
}
