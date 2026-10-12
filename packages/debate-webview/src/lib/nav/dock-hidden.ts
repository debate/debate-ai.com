/**
 * @fileoverview Whether the reader has hidden the app dock (the row of app
 * icons), shared by every dock instance in the document.
 *
 * Chosen from the dock's own Settings menu ("Hide dock"). While hidden, each
 * dock collapses to a small arrow tab that reveals the full dock on hover, and
 * the same menu row ("Show dock") puts it back. The choice is kept in
 * localStorage under {@link DOCK_HIDDEN_KEY} and broadcast like
 * `sidebar-collapse` in @debate/videos, so the desktop, mobile and
 * sidebar-hosted docks agree and the choice survives navigation and reloads.
 *
 * @module lib/nav/dock-hidden
 */

import { useSyncExternalStore } from "react"

/** localStorage key for the hidden/shown choice ("1" = hidden). */
export const DOCK_HIDDEN_KEY = "app-dock-hidden"

/** Same-document change event; other tabs get the real `storage` event. */
const CHANGE_EVENT = "app-dock-hidden-change"

/** Fallback when localStorage throws (private mode, blocked site data). */
let memoryHidden: boolean | null = null

/** True when the reader last hid the dock. */
export function readDockHidden(): boolean {
  if (memoryHidden !== null) return memoryHidden
  try {
    return localStorage.getItem(DOCK_HIDDEN_KEY) === "1"
  } catch {
    return false
  }
}

/** Hides (`true`) or shows (`false`) the dock everywhere, and remembers it. */
export function setDockHidden(hidden: boolean): void {
  if (readDockHidden() === hidden) return
  try {
    if (hidden) localStorage.setItem(DOCK_HIDDEN_KEY, "1")
    else localStorage.removeItem(DOCK_HIDDEN_KEY)
    memoryHidden = null
  } catch {
    // Blocked storage: the choice still applies to this page, just isn't kept.
    memoryHidden = hidden
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Flips the dock between hidden and shown. */
export function toggleDockHidden(): void {
  setDockHidden(!readDockHidden())
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DOCK_HIDDEN_KEY) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/**
 * The current hidden/shown choice. The server (and the hydrating render)
 * always see the dock shown, so markup never disagrees with the client.
 */
export function useDockHidden(): boolean {
  return useSyncExternalStore(subscribe, readDockHidden, () => false)
}
