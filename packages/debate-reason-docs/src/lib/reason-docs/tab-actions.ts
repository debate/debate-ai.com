/**
 * @fileoverview What closing and reopening editor tabs does to the tab strip
 * above Debate Editor: which tabs stay, which one becomes active, and what
 * "Undo close" brings back.
 *
 * Pure so the tab strip's right-click menu (Close, Close others, Close to the
 * right, Close all, Undo close) can be unit-tested without the provider;
 * `ReasonDocsProvider` holds the state and calls these.
 *
 * @module lib/reason-docs/tab-actions
 */

export interface TabState {
  openTabs: number[]
  activeId: number | null
  /** Closed tabs, most recently closed last — the "Undo close" stack. */
  closed: number[]
}

/** How many closed tabs "Undo close" can walk back through. */
export const CLOSED_TABS_LIMIT = 20

/**
 * Closes `ids`. The active tab stays active when it survives; when it is
 * closed, the nearest surviving tab takes over, preferring the one that slid
 * into its slot (the rule a single close has always followed).
 */
export function closeTabs(state: TabState, ids: readonly number[]): TabState {
  const closing = state.openTabs.filter((id) => ids.includes(id))
  if (closing.length === 0) return state
  const openTabs = state.openTabs.filter((id) => !ids.includes(id))
  const closed = [...state.closed.filter((id) => !closing.includes(id)), ...closing].slice(-CLOSED_TABS_LIMIT)

  let activeId = state.activeId
  if (activeId != null && closing.includes(activeId)) {
    const idx = state.openTabs.indexOf(activeId)
    const after = state.openTabs.slice(idx + 1).find((id) => openTabs.includes(id))
    const before = state.openTabs
      .slice(0, idx)
      .reverse()
      .find((id) => openTabs.includes(id))
    activeId = after ?? before ?? null
  }
  return { openTabs, activeId, closed }
}

/** Every tab but `id`, which becomes the active one. */
export function closeOtherTabs(state: TabState, id: number): TabState {
  const next = closeTabs(
    state,
    state.openTabs.filter((tabId) => tabId !== id),
  )
  return state.openTabs.includes(id) ? { ...next, activeId: id } : next
}

/** Every tab to the right of `id`. */
export function closeTabsToRight(state: TabState, id: number): TabState {
  const idx = state.openTabs.indexOf(id)
  if (idx < 0) return state
  return closeTabs(state, state.openTabs.slice(idx + 1))
}

export function closeAllTabs(state: TabState): TabState {
  return closeTabs(state, state.openTabs)
}

/**
 * Reopens the most recently closed tab that still exists (`exists` filters
 * out files deleted since) and makes it active. Unchanged when there is
 * nothing to reopen.
 */
export function reopenClosedTab(state: TabState, exists: (id: number) => boolean): TabState {
  const closed = [...state.closed]
  while (closed.length > 0) {
    const id = closed.pop()!
    if (!exists(id) || state.openTabs.includes(id)) continue
    return { openTabs: [...state.openTabs, id], activeId: id, closed }
  }
  return state.closed.length === 0 ? state : { ...state, closed }
}

/** Whether "Undo close" has anything to bring back. */
export function canReopenTab(state: TabState, exists: (id: number) => boolean): boolean {
  return state.closed.some((id) => exists(id) && !state.openTabs.includes(id))
}
