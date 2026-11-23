/**
 * @fileoverview The app-wide Backspace shortcut: a bare Backspace pressed
 * while the reader isn't typing goes back one page in the browser history,
 * like the browsers that used to do it themselves.
 *
 * Backspace is above all a text-editing key, so the shortcut stands aside
 * whenever the key could mean "delete": focus in an input, textarea, select
 * or anything contenteditable (the card editor's ProseMirror surfaces), a
 * widget that owns its keyboard (the flow grid, menus, listboxes, sliders),
 * a press that some handler already claimed with `preventDefault`, a held
 * modifier, or a key held down (auto-repeat would walk back several pages).
 *
 * Mounted once, by `AppShell`, and never inside a framed document: a page in
 * someone else's frame shares the top window's history, so stepping it back
 * would move the page around the frame.
 *
 * @module lib/nav/backspace-back
 */

import { useEffect } from "react"

/** The parts of a keyboard event the shortcut looks at. */
export type BackspaceKeyEvent = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "defaultPrevented" | "isComposing"
> & { target: EventTarget | null }

/** Tags whose focus means the reader is typing (or choosing) in a field. */
const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"])

/**
 * Elements that own their keyboard — a Backspace inside one is theirs, even
 * when focus isn't on a text field (a selected flow cell clears on Backspace).
 */
const KEYBOARD_OWNER_SELECTOR = [
  "[contenteditable]:not([contenteditable='false'])",
  "[role='textbox']",
  "[role='searchbox']",
  "[role='combobox']",
  "[role='grid']",
  "[role='listbox']",
  "[role='menu']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='application']",
  ".handsontable",
  "[data-no-backspace-back]",
].join(",")

/** Minimal element shape, so the check works without a DOM (and in tests). */
interface ElementLike {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

/** True when a Backspace aimed at `target` belongs to that element. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as ElementLike | null
  if (!el || typeof el !== "object") return false
  if (el.tagName && FIELD_TAGS.has(el.tagName.toUpperCase())) return true
  if (el.isContentEditable) return true
  if (typeof el.closest === "function" && el.closest(KEYBOARD_OWNER_SELECTOR)) return true
  return false
}

/** True when this keydown should take the reader back one page. */
export function isBackspaceBack(event: BackspaceKeyEvent): boolean {
  if (event.key !== "Backspace") return false
  if (event.defaultPrevented || event.repeat || event.isComposing) return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  return !isTypingTarget(event.target)
}

/**
 * Listens for the shortcut while `enabled`. Bubble phase on `window`, so any
 * element handler that handles Backspace itself (and calls `preventDefault`)
 * runs first and keeps the key.
 */
export function useBackspaceBack(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    window.addEventListener("keydown", onBackspaceBackKeyDown)
    return () => window.removeEventListener("keydown", onBackspaceBackKeyDown)
  }, [enabled])
}

/** The window keydown listener {@link useBackspaceBack} installs. */
export function onBackspaceBackKeyDown(event: KeyboardEvent): void {
  if (!isBackspaceBack(event)) return
  // Also catches focus that the event target doesn't reflect (a shadow root,
  // or a field focused after the press started).
  if (isTypingTarget(document.activeElement)) return
  event.preventDefault()
  window.history.back()
}
