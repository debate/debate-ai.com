/**
 * @file mark-history.ts
 * @description The undo / redo history behind the Marks menu's "Undo mark"
 * (`highlight-toggle.tsx`): every change to the reader's marks, whether
 * added, removed, reset or cleared, is kept so it can be taken back.
 *
 * Marking is DOM surgery (`@debate-ai/reading-mode/marks` splits text nodes
 * and wraps or unwraps them), so a change is recorded as the DOM mutations it
 * caused (`MutationObserver` records, taken synchronously around the action)
 * and undone by applying their inverses in reverse. Undoing records its own
 * mutations the same way, which is the redo. That covers every kind of mark
 * and every way of changing one, with nothing to add when a mark kind is added.
 *
 * The history is one list for the page and reading mode's copy of it: an
 * entry whose text is no longer on the page (reading mode closed) is dropped
 * when it comes up. The last `MARK_HISTORY_LIMIT` changes are kept; a new
 * change clears what could be redone.
 */

/** How many changes are kept (the menu promises at least 30). */
export const MARK_HISTORY_LIMIT = 50

/** Fired on `window` when the history's contents change, so menus can enable or disable Undo and Redo. */
export const HISTORY_EVENT = "debate-docs-mark-history-change"

interface Entry {
  root: HTMLElement
  records: MutationRecord[]
  /** Entries recorded with the same group merge into one (an AI cut made chunk by chunk). */
  group?: string
}

const undoStack: Entry[] = []
const redoStack: Entry[] = []

const OBSERVE: MutationObserverInit = {
  subtree: true,
  childList: true,
  attributes: true,
  attributeOldValue: true,
  characterData: true,
  characterDataOldValue: true,
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HISTORY_EVENT))
}

/** Runs `action` and returns what it did to `root`'s DOM. */
function capture<T>(root: HTMLElement, action: () => T): { result: T; records: MutationRecord[] } {
  const observer = new MutationObserver(() => {})
  observer.observe(root, OBSERVE)
  try {
    const result = action()
    return { result, records: observer.takeRecords() }
  } finally {
    observer.disconnect()
  }
}

/** Puts the DOM back as it was before `records`, newest first. */
function revert(records: MutationRecord[]) {
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]!
    const target = record.target
    if (record.type === "attributes") {
      const element = target as Element
      if (record.oldValue === null) element.removeAttribute(record.attributeName!)
      else element.setAttribute(record.attributeName!, record.oldValue)
    } else if (record.type === "characterData") {
      ;(target as CharacterData).data = record.oldValue ?? ""
    } else {
      for (const node of Array.from(record.addedNodes)) node.parentNode?.removeChild(node)
      const next = record.nextSibling && record.nextSibling.parentNode === target ? record.nextSibling : null
      for (const node of Array.from(record.removedNodes)) target.insertBefore(node, next)
    }
  }
}

/**
 * Runs a marking action on `root` and remembers it as one undoable change.
 * Returns the action's result. Nothing is remembered when it changed nothing.
 * Pass the same `group` for consecutive calls that are one change to the reader.
 */
export function recordMarkChange<T>(root: HTMLElement, action: () => T, group?: string): T {
  const { result, records } = capture(root, action)
  if (records.length === 0) return result
  const last = undoStack[undoStack.length - 1]
  if (group && last && last.group === group && last.root === root) {
    last.records.push(...records)
  } else {
    undoStack.push({ root, records, group })
    if (undoStack.length > MARK_HISTORY_LIMIT) undoStack.shift()
  }
  redoStack.length = 0
  notify()
  return result
}

/** Takes `entry` off `from`, applies its inverse, and puts what that did on `to`. Skips entries no longer on the page. */
function step(from: Entry[], to: Entry[]): boolean {
  for (let entry = from.pop(); entry; entry = from.pop()) {
    if (!entry.root.isConnected) continue
    const { records } = capture(entry.root, () => revert(entry.records))
    to.push({ root: entry.root, records })
    if (to.length > MARK_HISTORY_LIMIT) to.shift()
    notify()
    return true
  }
  notify()
  return false
}

/** Takes back the latest mark change. Returns whether there was one. */
export function undoMark(): boolean {
  return step(undoStack, redoStack)
}

/** Puts back the mark change `undoMark` took off. Returns whether there was one. */
export function redoMark(): boolean {
  return step(redoStack, undoStack)
}

export function canUndoMark(): boolean {
  return undoStack.some((entry) => entry.root.isConnected)
}

export function canRedoMark(): boolean {
  return redoStack.some((entry) => entry.root.isConnected)
}

/** Forgets the whole history. */
export function clearMarkHistory() {
  undoStack.length = 0
  redoStack.length = 0
  notify()
}

/** Whether a keystroke is meant for a text field's own undo. */
function inEditable(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])")
}

/**
 * The shortcut handler: Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z and Ctrl+Y redo.
 * Leaves the key alone in text fields and when there is nothing to undo or
 * redo, so the browser's own undo keeps working there. Returns whether it acted.
 */
export function handleMarkHistoryKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return false
  const key = event.key.toLowerCase()
  const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey)
  const undo = key === "z" && !event.shiftKey
  if (!undo && !redo) return false
  if (inEditable(event.target)) return false
  if (!(redo ? redoMark() : undoMark())) return false
  event.preventDefault()
  return true
}
