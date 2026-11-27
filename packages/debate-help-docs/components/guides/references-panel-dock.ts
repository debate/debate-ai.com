/**
 * @file references-panel-dock.ts
 * @description The layout side of the References panel
 * (`references-panel.tsx`): its width, and docking it to the page.
 *
 * On a wide screen the open panel is a column at the right edge that pushes
 * the page aside instead of covering it. The panel itself is a `fixed`
 * element portaled to `<body>` (it is opened from the header's toolbar,
 * far from any layout column), so docking is done with two things on
 * `<html>`, which `styles/docs.css` turns into layout:
 *
 * - `data-references-docked`: the page makes room (`<body>` padding) and
 *   hides the right-hand "On this page" outline while it is set;
 * - `--references-panel-width`: how much room.
 *
 * Below `DOCK_MIN_VIEWPORT` the panel stays a drawer over the page and none of
 * this is set. The page's panel and reading mode's (both can be open at once)
 * share one attribute, so it is cleared only when the last docked panel closes.
 */

/** The panel's original width was 28rem; the default is 25% narrower, 21rem. */
export const DEFAULT_PANEL_WIDTH = 336
export const MIN_PANEL_WIDTH = 240
export const MAX_PANEL_WIDTH = 720
/** The panel never takes more than this share of the window. */
export const MAX_PANEL_SHARE = 0.6
/** Keyboard resize steps, in pixels (Shift for the larger). */
export const KEY_STEP = 16
export const KEY_STEP_LARGE = 64
/** At and above this width (Tailwind's `lg`) the panel docks; below it, a drawer. */
export const DOCK_MIN_VIEWPORT = 1024

export const WIDTH_STORAGE_KEY = "debate-docs-references-panel-width"
export const DOCKED_ATTRIBUTE = "data-references-docked"
export const RESIZING_ATTRIBUTE = "data-references-resizing"
export const WIDTH_VARIABLE = "--references-panel-width"

/** The widest the panel may be in a window `viewport` pixels wide. */
export function maxPanelWidth(viewport: number): number {
  const share = Math.floor(viewport * MAX_PANEL_SHARE)
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, share))
}

/** `width` held between the minimum and what `viewport` allows; the default for a non-number. */
export function clampPanelWidth(width: number, viewport: number): number {
  const value = Number.isFinite(width) ? Math.round(width) : DEFAULT_PANEL_WIDTH
  return Math.min(maxPanelWidth(viewport), Math.max(MIN_PANEL_WIDTH, value))
}

/** The width the reader left it at, if any. */
export function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    if (raw === null) return DEFAULT_PANEL_WIDTH
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : DEFAULT_PANEL_WIDTH
  } catch {
    return DEFAULT_PANEL_WIDTH
  }
}

export function storeWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)))
  } catch {
    // Blocked storage: the width lasts until the page changes.
  }
}

/** Whether the window is wide enough to dock the panel beside the page. */
export function canDock(): boolean {
  if (typeof window === "undefined") return false
  if (typeof window.matchMedia === "function") return window.matchMedia(`(min-width: ${DOCK_MIN_VIEWPORT}px)`).matches
  return window.innerWidth >= DOCK_MIN_VIEWPORT
}

/** Calls `onChange` when the window crosses the docking breakpoint (or is resized, where there is no media query). */
export function subscribeToDockable(onChange: () => void): () => void {
  if (typeof window.matchMedia === "function") {
    const query = window.matchMedia(`(min-width: ${DOCK_MIN_VIEWPORT}px)`)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

let dockedPanels = 0

/**
 * Docks a panel: the page makes room for `width` pixels and hides its outline.
 * Returns the function that undocks it; the page is restored when the last
 * docked panel is gone.
 */
export function dockPanel(width: number): () => void {
  const root = document.documentElement
  dockedPanels += 1
  root.setAttribute(DOCKED_ATTRIBUTE, "")
  root.style.setProperty(WIDTH_VARIABLE, `${width}px`)
  let released = false
  return () => {
    if (released) return
    released = true
    dockedPanels = Math.max(0, dockedPanels - 1)
    if (dockedPanels === 0) {
      root.removeAttribute(DOCKED_ATTRIBUTE)
      root.style.removeProperty(WIDTH_VARIABLE)
    }
  }
}

/** Changes how much room a docked panel takes. */
export function setDockedWidth(width: number) {
  document.documentElement.style.setProperty(WIDTH_VARIABLE, `${width}px`)
}

/** The width after a key press on the resize handle (the panel is on the right, so Left widens it); null for other keys. */
export function widthForKey(key: string, shift: boolean, width: number, viewport: number): number | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP
  switch (key) {
    case "ArrowLeft":
    case "ArrowUp":
      return clampPanelWidth(width + step, viewport)
    case "ArrowRight":
    case "ArrowDown":
      return clampPanelWidth(width - step, viewport)
    case "Home":
      return MIN_PANEL_WIDTH
    case "End":
      return maxPanelWidth(viewport)
    default:
      return null
  }
}
