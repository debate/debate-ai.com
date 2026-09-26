/**
 * @fileoverview Pure bookkeeping for the auto-saved flow history
 * (`flow-history` in localStorage, written by `useFlowStore().saveToHistory`).
 *
 * The store used to push a full snapshot on every change and keep only the
 * newest 20, so a minute of typing in one flow pushed every other flow's
 * history out — and a quota error wiped the whole log. Here:
 *
 * - An unchanged snapshot of the newest entry's flow is not saved again
 *   (switching tabs back and forth no longer floods the log).
 * - Edits to the same flow within {@link HISTORY_COALESCE_MS} update that
 *   flow's newest entry in place, so history keeps one version per flow per
 *   stretch of work instead of one per keystroke.
 * - Up to {@link MAX_HISTORY_ENTRIES} entries are kept, and on a quota error
 *   the oldest are dropped one batch at a time until the rest fit.
 *
 * @module state/flowHistoryEntries
 */

import type { Flow } from "../types/flow"

export const FLOW_HISTORY_KEY = "flow-history"
export const MAX_HISTORY_ENTRIES = 100
export const HISTORY_COALESCE_MS = 60_000

export interface FlowHistoryEntry {
  id: string
  flow: Flow
  timestamp: number
  label: string
}

/** Snapshot comparison that ignores UI-only focus state. */
function snapshotKey(flow: Flow): string {
  return JSON.stringify(flow, (key, value) => (key === "focus" || key === "lastFocus" ? undefined : value))
}

/**
 * Returns the history with `flow` recorded — newest first — or the same
 * array when nothing changed since that flow's newest entry.
 */
export function addFlowHistoryEntry(history: FlowHistoryEntry[], flow: Flow, now = Date.now()): FlowHistoryEntry[] {
  const snapshot = JSON.parse(JSON.stringify(flow)) as Flow
  const newestForFlow = history.findIndex((entry) => entry.flow?.id === flow.id)
  const previous = newestForFlow === -1 ? undefined : history[newestForFlow]

  if (previous && snapshotKey(previous.flow) === snapshotKey(snapshot)) return history

  const entry: FlowHistoryEntry = {
    id: `${flow.id}-${now}`,
    flow: snapshot,
    timestamp: now,
    label: flow.content || "Untitled Flow",
  }

  // Keep editing the newest entry while it's still the newest thing saved.
  if (newestForFlow === 0 && previous && now - previous.timestamp < HISTORY_COALESCE_MS) {
    return [{ ...entry, id: previous.id }, ...history.slice(1)]
  }
  return [entry, ...history].slice(0, MAX_HISTORY_ENTRIES)
}

export function readFlowHistory(storage: Pick<Storage, "getItem"> = localStorage): FlowHistoryEntry[] {
  try {
    const raw = storage.getItem(FLOW_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.id === "string" && e.flow) : []
  } catch {
    return []
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  )
}

/**
 * Writes the history, dropping the oldest quarter at a time on a quota
 * error until it fits. Returns how many entries were kept.
 */
export function writeFlowHistory(
  history: FlowHistoryEntry[],
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage,
): number {
  let entries = history
  for (;;) {
    try {
      storage.setItem(FLOW_HISTORY_KEY, JSON.stringify(entries))
      return entries.length
    } catch (error) {
      if (!isQuotaError(error) || entries.length <= 1) {
        if (isQuotaError(error)) storage.removeItem(FLOW_HISTORY_KEY)
        console.error("Unable to save flow history:", error)
        return 0
      }
      entries = entries.slice(0, Math.max(1, Math.floor(entries.length * 0.75)))
    }
  }
}

/** The flow a history entry restores to: a fresh, un-archived copy placed at `index`. */
export function flowFromHistoryEntry(entry: FlowHistoryEntry, index: number, id = Date.now()): Flow {
  return { ...(JSON.parse(JSON.stringify(entry.flow)) as Flow), id, index, archived: false }
}
