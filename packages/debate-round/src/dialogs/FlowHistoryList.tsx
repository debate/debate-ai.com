"use client"

/**
 * @fileoverview `FlowHistoryDialog`'s "History" tab — the auto-saved
 * undo/version log (`flow-history`, synced to the account via
 * `debate-data-sync`'s `flowHistory` collection), distinct from the
 * "Rounds" tab's explicitly-created rounds and the "Saved to account"
 * tab's explicit cloud saves. Every entry here was captured automatically
 * as the user worked (`useFlowStore().saveToHistory`), with no save action
 * of their own.
 *
 * Split out of `FlowHistoryDialog` so the grouped-by-day list is
 * unit-testable via `react-dom/server` without needing the dialog's tab
 * switcher (this package's Vitest environment is `node`, with no DOM to
 * click through — see `test/panels.test.tsx`).
 *
 * @module dialogs/FlowHistoryList
 */

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Clock, Download, FileText, Trash2 } from "lucide-react"
import { Button } from "../ui/primitives/button"
import type { FlowHistory } from "../state/store"
import { groupFlowHistoryByDate } from "../state/flowHistoryGrouping"

interface FlowHistoryListProps {
  /** The full auto-saved history, newest entry first — `useFlowStore().getFlowHistory()`'s return value. */
  history: FlowHistory[]
  /** Restores the given entry as a new flow and closes the dialog. */
  onLoad: (historyId: string) => void
  /** Clears the entire local history after confirmation. */
  onClear: () => void
}

/**
 * Renders `history` grouped by the day it was captured, each day
 * collapsible, newest day and newest entry-within-a-day first. All days
 * start expanded — this component is only mounted while the "History" tab
 * is active, so remounting it (switching tabs away and back) is what
 * resets that, rather than tracking "dialog just opened" separately.
 */
export function FlowHistoryList({ history, onLoad, onClear }: FlowHistoryListProps) {
  const groups = useMemo(() => groupFlowHistoryByDate(history), [history])
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())

  const toggleDate = (dateKey: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center p-8">
          <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No history yet</p>
          <p className="text-xs mt-2">Every change is auto-saved here as you work.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <p className="text-xs text-muted-foreground">Auto-saved as you work. Synced to your account.</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear history
        </Button>
      </div>
      {groups.map((group) => {
        const collapsed = collapsedDates.has(group.dateKey)
        return (
          <div key={group.dateKey} className="border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => toggleDate(group.dateKey)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-sm font-medium"
            >
              <span className="flex items-center gap-1.5">
                {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {group.dateKey}
              </span>
              <span className="text-xs text-muted-foreground">
                {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
              </span>
            </button>
            {!collapsed && (
              <div className="divide-y">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="text-sm truncate">{entry.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 flex-shrink-0"
                      title="Restore this version as a new flow"
                      onClick={() => onLoad(entry.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
