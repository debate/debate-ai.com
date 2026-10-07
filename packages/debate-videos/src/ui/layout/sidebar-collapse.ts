/**
 * @fileoverview Whether the app's sidebar column is hidden, shared by every
 * place that draws it or reacts to it.
 *
 * The column (`ResizableSidebarLayout`) is the one sidebar every view uses,
 * so hiding it is one choice, not one per page: it is kept in localStorage
 * under {@link SIDEBAR_COLLAPSED_KEY} and broadcast to every subscriber in
 * the document, so the dock (which floats while the column is hidden) and the
 * column agree, and crossing to another page keeps the column hidden.
 *
 * @module ui/layout/sidebar-collapse
 */

import { useSyncExternalStore } from "react"

/** localStorage key for the hidden/shown choice ("1" = hidden). */
export const SIDEBAR_COLLAPSED_KEY = "app-sidebar-collapsed"

/** Same-document change event; other tabs get the real `storage` event. */
const CHANGE_EVENT = "app-sidebar-collapsed-change"

/** True when the reader last hid the sidebar. */
export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

/** Hides (`true`) or shows (`false`) the sidebar everywhere, and remembers it. */
export function setSidebarCollapsed(collapsed: boolean): void {
  if (readSidebarCollapsed() === collapsed) return
  try {
    if (collapsed) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1")
    else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY)
  } catch {
    // Blocked storage: the choice still applies to this page, just isn't kept.
    memoryCollapsed = collapsed
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Flips the sidebar between hidden and shown. */
export function toggleSidebarCollapsed(): void {
  setSidebarCollapsed(!getSnapshot())
}

/** Fallback when localStorage throws (private mode, blocked site data). */
let memoryCollapsed: boolean | null = null

function getSnapshot(): boolean {
  return memoryCollapsed ?? readSidebarCollapsed()
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_COLLAPSED_KEY) onChange()
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
 * always see the sidebar shown, so markup never disagrees with the client.
 */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
